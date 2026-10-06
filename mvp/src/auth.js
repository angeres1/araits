import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './logic.js';

export function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(pin), salt, 32).toString('hex') };
}

// Basic brute-force guard: 5 failures per user in 5 minutes.
const fails = new Map();

export function login(db, { user_id, pin }) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(user_id));
  const f = fails.get(u?.id ?? 'x') || [];
  const recent = f.filter((t) => Date.now() - t < 300_000);
  if (recent.length >= 5) throw new HttpError(429, 'demasiados_intentos');
  const ok = u && timingSafeEqual(scryptSync(String(pin ?? ''), u.pin_salt, 32), Buffer.from(u.pin_hash, 'hex'));
  if (!ok) {
    fails.set(u?.id ?? 'x', [...recent, Date.now()]);
    throw new HttpError(401, 'credenciales_invalidas');
  }
  fails.delete(u.id);
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, u.id, new Date().toISOString());
  return { token, user: { id: u.id, name: u.name, role: u.role } };
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
