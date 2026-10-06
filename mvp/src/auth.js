import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './logic.js';

export function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(pin), salt, 32).toString('hex') };
}

// Brute-force guard: 5 failures per (ip,user) and 20 per ip, per 5 minutes.
// Keyed by IP so a remote attacker cannot lock out the real user on the warehouse network.
const fails = new Map();
const recentFails = (key) => { const r = (fails.get(key) || []).filter((t) => Date.now() - t < 300_000); fails.set(key, r); return r; };

export function login(db, body, ip = '?') {
  const { user_id, pin } = body || {};
  const uKey = `${ip}|${Number(user_id)}`;
  if (recentFails(uKey).length >= 5 || recentFails(ip).length >= 20) throw new HttpError(429, 'demasiados_intentos');
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(user_id));
  const ok = u && timingSafeEqual(scryptSync(String(pin ?? ''), u.pin_salt, 32), Buffer.from(u.pin_hash, 'hex'));
  if (!ok) {
    recentFails(uKey).push(Date.now()); recentFails(ip).push(Date.now());
    throw new HttpError(401, 'credenciales_invalidas');
  }
  fails.delete(uKey);
  db.prepare('DELETE FROM sessions WHERE created_at < ?').run(new Date(Date.now() - 12 * 3600_000).toISOString());
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, u.id, new Date().toISOString());
  return { token, user: { id: u.id, name: u.name, role: u.role } };
}

export function logout(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return { ok: true };
}

export function userFromToken(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.created_at > ?`).get(token, new Date(Date.now() - 12 * 3600_000).toISOString()) || null;
}

export function publicUsers(db) {
  return db.prepare('SELECT id, name, role FROM users ORDER BY id').all();
}

// Role -> permissions. 'admin' passes everything.
export const PERMS = {
  ingreso: ['bodega'],
  stock: ['bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial'],
  pedidos: ['alistamiento'],
  vincular: ['devoluciones'],
  tipificar: ['operador'],
  devoluciones_ver: ['devoluciones', 'operador'],
  crm: ['comercial'],
};
export const can = (user, perm) => user.role === 'admin' || PERMS[perm]?.includes(user.role);
