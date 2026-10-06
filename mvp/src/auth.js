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
  if (!u.active) throw new HttpError(401, 'credenciales_invalidas');
  fails.delete(uKey);
  db.prepare('DELETE FROM sessions WHERE created_at < ?').run(new Date(Date.now() - 12 * 3600_000).toISOString());
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, u.id, new Date().toISOString());
  return { token, user: { id: u.id, name: u.name, role: u.role, must_change_pin: !!u.must_change_pin } };
}

export function logout(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return { ok: true };
}

export function userFromToken(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.name, u.role, u.must_change_pin FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.created_at > ? AND u.active = 1`).get(token, new Date(Date.now() - 12 * 3600_000).toISOString()) || null;
}

// Login selector only: id + display name + role (no PIN material). Tradeoff: exposes the staff list on the LAN.
export function publicUsers(db) {
  return db.prepare('SELECT id, name, role FROM users WHERE active = 1 ORDER BY id').all();
}

export const ROLES = ['admin', 'bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial'];
const PIN_RE = /^\d{6,10}$/;
const weak = (p) => /^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p);

export function changePin(db, user, token, { old_pin, new_pin }) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!timingSafeEqual(scryptSync(String(old_pin ?? ''), u.pin_salt, 32), Buffer.from(u.pin_hash, 'hex'))) throw new HttpError(401, 'pin_actual_incorrecto');
  if (!PIN_RE.test(String(new_pin))) throw new HttpError(400, 'pin_invalido', 'El PIN nuevo debe tener entre 6 y 10 dígitos.');
  if (weak(String(new_pin)) || new_pin === old_pin) throw new HttpError(400, 'pin_debil', 'Elige un PIN que no sea repetido ni consecutivo, y distinto al actual.');
  const { salt, hash } = hashPin(new_pin);
  db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, must_change_pin = 0 WHERE id = ?').run(hash, salt, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, token);
  return { ok: true };
}

// ----- admin user management (temporary PINs force a change on first login) -----
export function listUsers(db) {
  return db.prepare('SELECT id, name, role, active, must_change_pin FROM users ORDER BY id').all();
}
function tempPin() { return String(100000 + Math.floor(Math.random() * 900000)); }
export function createUser(db, { name, role }) {
  const nm = String(name ?? '').trim().slice(0, 60);
  if (!nm) throw new HttpError(400, 'nombre_requerido');
  if (!ROLES.includes(role)) throw new HttpError(400, 'rol_invalido');
  const pin = tempPin(); const { salt, hash } = hashPin(pin);
  const r = db.prepare('INSERT INTO users (name, role, pin_hash, pin_salt, must_change_pin) VALUES (?,?,?,?,1)').run(nm, role, hash, salt);
  return { id: Number(r.lastInsertRowid), name: nm, role, temp_pin: pin };
}
export function resetUserPin(db, id) {
  const pin = tempPin(); const { salt, hash } = hashPin(pin);
  const r = db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, must_change_pin = 1 WHERE id = ?').run(hash, salt, id);
  if (!r.changes) throw new HttpError(404, 'usuario_no_existe');
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return { id, temp_pin: pin };
}
export function setUserActive(db, id, active, actingId) {
  if (id === actingId && !active) throw new HttpError(409, 'no_puedes_desactivarte');
  const r = db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (!r.changes) throw new HttpError(404, 'usuario_no_existe');
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return { id, active: !!active };
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
  dashboard: ['bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial'],
  reportes: ['comercial', 'alistamiento'],
};
export const can = (user, perm) => user.role === 'admin' || PERMS[perm]?.includes(user.role);
