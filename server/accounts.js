import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { divisions, operational } from './config.js';
import { ApiError } from './errors.js';

const digest = value => createHash('sha256').update(value).digest('hex');
export function publicUser(row) {
  if (!row) return null;
  const { id, username, name, division, role, review_divisions } = row;
  return { id, username, name, division, role, reviewDivisions: JSON.parse(review_divisions) };
}

const leadership = new Map([['Supervisor','supervisor'],['Manajer','manager'],['Direktur','director']]);

export async function approveAccount(username, division, reviewDivisions) {
  const role = leadership.get(division);
  if (!role || (role === 'director' ? reviewDivisions.length : !reviewDivisions.length) || reviewDivisions.some(d => !operational.includes(d))) {
    throw new Error('Periksa divisi dan cakupan --review untuk Manajer atau Supervisor.');
  }
  const row = await db.get("UPDATE users SET role=?,review_divisions=? WHERE username=? AND division=? AND role='pending' RETURNING id",role,JSON.stringify(reviewDivisions),username.toLowerCase(),division);
  if (!row) throw new Error('Pengajuan tidak ditemukan untuk nama pengguna dan divisi ini.');
  return row.id;
}

export async function addUser({ username, name, division, role = leadership.get(division) || 'staff', reviewDivisions = [], password }) {
  if (typeof username !== 'string' || !/^[\w.-]{2,60}$/.test(username) || typeof name !== 'string' || !name.trim() || name.length > 100 || !divisions.includes(division)) {
    throw new ApiError(400,'Periksa nama pengguna, nama lengkap, dan divisi.');
  }
  if (!['staff', 'supervisor', 'manager','pending','director'].includes(role) || !Array.isArray(reviewDivisions) || reviewDivisions.some(d => !operational.includes(d))) {
    throw new Error('Peran atau daftar divisi tinjauan tidak valid.');
  }
  if (role === 'pending' && !leadership.has(division)) throw new Error('Divisi pengajuan tidak valid.');
  if ((role === 'director' || division === 'Direktur') && !(division === 'Direktur' && ['pending','director'].includes(role))) throw new Error('Peran Direktur tidak valid.');
  if (role !== 'pending' && division === 'Supervisor' && (role !== 'supervisor' || !reviewDivisions.length)) {
    throw new Error('Akun divisi Supervisor memerlukan peran supervisor dan setidaknya satu divisi tinjauan (--review).');
  }
  if (division === 'Manajer' && !['pending','manager'].includes(role)) throw new Error('Pilih peran manager untuk divisi Manajer.');
  if (role === 'staff' && reviewDivisions.length) throw new Error('Daftar divisi tinjauan hanya berlaku untuk akun peninjau.');
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) throw new ApiError(400,'Kata sandi perlu 10–200 karakter.');
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  const result = await db.get('INSERT INTO users(username,name,division,role,review_divisions,password_hash) VALUES(?,?,?,?,?,?) ON CONFLICT(username) DO NOTHING RETURNING id', username.toLowerCase(), name.trim(), division, role, JSON.stringify(reviewDivisions), salt + ':' + key);
  if (!result) throw new ApiError(409,'Nama pengguna sudah digunakan. Pilih nama pengguna lain.');
  return result.id;
}

const fallbackSalt = randomBytes(16).toString('hex');
export async function authenticate(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200 || username.length > 60) return null;
  const row = await db.get('SELECT * FROM users WHERE username=?', username.trim().toLowerCase());
  const [salt, expected] = row?.password_hash.split(':') || [fallbackSalt, '00'.repeat(64)];
  const actual = scryptSync(password, salt, 64);
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex')) || !row) return null;
  if (row.role === 'pending') throw new ApiError(403,'Pengajuan akun masih menunggu persetujuan administrator.');
  return publicUser(row);
}

export async function makeSession(userId) {
  await db.run('DELETE FROM sessions WHERE expires <= ?', Date.now());
  const token = randomBytes(32).toString('hex');
  await db.run('INSERT INTO sessions VALUES (?,?,?)', digest(token), userId, Date.now() + 12 * 3600000);
  return token;
}
export async function sessionUser(token) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return publicUser(await db.get('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', digest(token), Date.now()));
}
export async function closeSession(token) {
  if (token) await db.run('DELETE FROM sessions WHERE token_hash=?', digest(token));
}
