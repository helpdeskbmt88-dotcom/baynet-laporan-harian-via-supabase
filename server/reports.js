import { db, transaction } from './db.js';
import { attachmentDivisions, divisions, operational, regularDivisions, shifts, statuses, todayWIB } from './config.js';

import { ApiError } from './errors.js';
export { ApiError };
const fail = (status, message, fields) => { throw new ApiError(status, message, fields); };
const now = () => new Date().toISOString();
const selectReports = 'SELECT r.*, u.name AS "authorName", u.division, u.review_divisions AS "authorScope" FROM reports r JOIN users u ON r.author_id=u.id';
const raw = id => db.get(selectReports + ' WHERE r.id=?', id);
const isOwner = (user, row) => row.author_id === user.id;
const editable = (user, row) => isOwner(user, row) && ['draft','revision'].includes(row.status);
const designated = (user, division) => user.reviewDivisions.includes(division);
const managerStage = row => row.status === 'supervisor_approved' || (row.division === 'Supervisor' && row.status === 'submitted');

function visible(user, row) {
  if (isOwner(user, row)) return true;
  if (row.status === 'draft' || user.role === 'staff') return false;
  if (row.division === 'Supervisor') {
    return user.role === 'manager' && JSON.parse(row.authorScope).some(division => designated(user,division));
  }
  if (!operational.includes(row.division) || !designated(user, row.division)) return false;
  return user.role === 'supervisor' || ['supervisor_approved','approved'].includes(row.status);
}

function reviewable(user, row) {
  if (isOwner(user, row) || !visible(user, row)) return false;
  if (user.role === 'manager') return managerStage(row);
  return user.role === 'supervisor' && operational.includes(row.division) && row.status === 'submitted';
}

async function requireRow(user, id) {
  const row = await raw(id);
  if (!row || !visible(user, row)) fail(404, 'Laporan tidak ditemukan atau berada di luar akses Anda.');
  return row;
}
async function requireEditable(user, id) {
  const row = await requireRow(user, id);
  if (!editable(user, row)) fail(403, 'Hanya pembuat yang dapat mengubah draf atau laporan yang perlu revisi.');
  return row;
}
function checkVersion(row, version) {
  if (row.version !== version) fail(409, 'Laporan telah berubah. Buka kembali laporan terbaru sebelum melanjutkan.');
}

async function present(user, row) {
  return {
    id: row.id, authorId: row.author_id, authorName: row.authorName, division: row.division,
    date: row.date, shift: row.shift, status: row.status, activities: JSON.parse(row.activities),
    attachments: await db.all('SELECT id,name,mime,size FROM attachments WHERE report_id=? ORDER BY id', row.id),
    history: await db.all('SELECT h.status,u.name AS "by",h.note,h.at FROM history h JOIN users u ON h.actor_id=u.id WHERE h.report_id=? ORDER BY h.id', row.id),
    createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
    canEdit: editable(user, row), canReview: reviewable(user, row), canDelete: isOwner(user, row) && row.status === 'draft',
  };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
async function filteredRows(filters) {
  const where = [];
  const args = [];
  for (const key of ['date','division','shift','status']) {
    const value = filters[key];
    if (value === undefined || value === '') continue;
    const valid = key === 'date' ? validDate(value) : ({ division: divisions, shift: shifts, status: statuses })[key].includes(value);
    if (!valid) fail(400, 'Filter laporan tidak valid.');
    where.push((key === 'division' ? 'u.' : 'r.') + key + '=?');
    args.push(value);
  }
  const sql = selectReports + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY r.updated_at DESC,r.id DESC';
  return db.all(sql, ...args);
}
export async function listReports(user, filters) {
  const rows = (await filteredRows(filters)).filter(row => visible(user, row) && (filters.mine !== '1' || isOwner(user,row)));
  return Promise.all(rows.map(row => present(user, row)));
}
export async function getReport(user, id) { return present(user, await requireRow(user, id)); }

function readText(value, max, label) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.trim().length > max) fail(422, label + ' maksimal ' + max + ' karakter.');
  return value.trim();
}
function validateInput(input) {
  const { date, shift, activities } = input;
  if (!validDate(date)) fail(422, 'Periksa tanggal laporan.', { date: 'Gunakan tanggal yang valid.' });
  if (!shifts.includes(shift)) fail(422, 'Pilih Shift Pagi atau Shift Siang.', { shift: 'Pilih salah satu shift.' });
  if (!Array.isArray(activities) || activities.length > 30) fail(422, 'Satu laporan dapat berisi hingga 30 aktivitas.');
  return activities.map((a, index) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) fail(422, 'Periksa aktivitas ke-' + (index + 1) + '.');
    return Object.fromEntries(['activity','result','obstacle','followUp','detail'].map(k => [k, readText(a[k], 1000, 'Setiap kolom aktivitas')]));
  });
}
export async function addHistory(reportId, status, actorId, note = '', at = now()) {
  await db.run('INSERT INTO history(report_id,status,actor_id,note,at) VALUES(?,?,?,?,?)', reportId,status,actorId,note,at);
}
export async function saveReport(user, id, input = {}) {
  return transaction(async () => {
    const row = id == null ? null : await requireEditable(user, id);
    if (row) checkVersion(row, input.version);
    const activities = JSON.stringify(validateInput(input));
    const slot = regularDivisions.includes(user.division) ? 'Harian' : input.shift;
    const duplicate = await db.get('SELECT id FROM reports WHERE author_id=? AND date=? AND slot=? AND id<>?', user.id,input.date,slot,id || 0);
    if (duplicate) fail(409, 'Laporan Anda untuk tanggal dan periode ini sudah ada. Buka laporan tersebut untuk melanjutkan.');
    if (row) {
      await db.run('UPDATE reports SET date=?,shift=?,slot=?,activities=?,version=version+1,updated_at=? WHERE id=?', input.date,input.shift,slot,activities,now(),id);
    } else {
      const ts = now();
      id = (await db.get('INSERT INTO reports(author_id,date,shift,slot,activities,created_at,updated_at) VALUES(?,?,?,?,?,?,?) RETURNING id', user.id,input.date,input.shift,slot,activities,ts,ts)).id;
      await addHistory(id, 'draft', user.id);
    }
    return getReport(user, id);
  });
}
export async function deleteReport(user, id, version) {
  return transaction(async () => {
    const row = await requireEditable(user,id);
    if (version !== undefined) checkVersion(row,version);
    if (row.status !== 'draft') fail(409,'Hanya draf yang dapat dihapus.');
    await db.run('DELETE FROM reports WHERE id=?', id);
  });
}
async function setStatus(id, status, actorId, note = '') {
  const ts = now();
  await db.run('UPDATE reports SET status=?, version=version+1, updated_at=? WHERE id=?', status,ts,id);
  await addHistory(id,status,actorId,note,ts);
}
export async function submitReport(user, id, version) {
  return transaction(async () => {
    const row = await requireEditable(user,id);
    checkVersion(row,version);
    const activities = JSON.parse(row.activities);
    if (!activities.length || activities.some(a => !a.activity || !a.result)) fail(422,'Isi aktivitas dan hasil pada setiap baris sebelum mengirim laporan.');
    if (row.date > todayWIB()) fail(422,'Laporan untuk tanggal mendatang belum dapat dikirim.');
    await setStatus(id,user.division === 'Manajer' ? 'approved' : 'submitted',user.id);
    return getReport(user,id);
  });
}
export async function reviewReport(user, id, input) {
  return transaction(async () => {
    const row = await requireRow(user,id);
    if (!reviewable(user,row)) fail(403,'Laporan ini tidak berada dalam antrean tinjauan Anda.');
    checkVersion(row,input.version);
    if (!['revise','approve'].includes(input.action)) fail(422,'Pilih setujui atau minta revisi.');
    const note = readText(input.note,1000,'Catatan tinjauan');
    if (input.action === 'revise' && !note) fail(422,'Tuliskan bagian yang perlu diperbaiki.',{note:'Catatan revisi wajib diisi.'});
    const status = input.action === 'revise' ? 'revision' : user.role === 'manager' ? 'approved' : 'supervisor_approved';
    await setStatus(id,status,user.id,note);
    // The reviewer may lose queue visibility after returning a report to its author.
    return present(user,await raw(id));
  });
}

const mimeTypes = {
  'image/jpeg': { extensions: ['jpg','jpeg'], valid: b => b.subarray(0,3).equals(Buffer.from([255,216,255])) },
  'image/png': { extensions: ['png'], valid: b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  'image/webp': { extensions: ['webp'], valid: b => b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' },
  'application/pdf': { extensions: ['pdf'], valid: b => b.toString('ascii',0,5) === '%PDF-' },
};
const touch = async id => await db.run('UPDATE reports SET version=version+1,updated_at=? WHERE id=?', now(),id);
export async function addAttachment(user,id,input) {
  return transaction(async () => {
    const row = await requireEditable(user,id);
    if (!attachmentDivisions.includes(row.division)) fail(403,'Divisi ini tidak menerima lampiran bukti.');
    const name = readText(input.name,180,'Nama file').replace(/[\\/\u0000-\u001f\u007f]/g,'_');
    const type = Object.hasOwn(mimeTypes,input.mime) && mimeTypes[input.mime];
    if (!type || !type.extensions.includes(name.split('.').pop().toLowerCase())) fail(422,'Pilih file JPG, PNG, WebP, atau PDF dengan ekstensi yang sesuai.');
    if (typeof input.data !== 'string' || input.data.length > 4 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) fail(422,'Lampiran harus berisi file yang valid dengan ukuran maksimum 3 MiB.');
    const bytes = Buffer.from(input.data,'base64');
    if (!bytes.length || bytes.length > 3*1024*1024 || !type.valid(bytes)) fail(422,'Isi file tidak sesuai dengan tipe atau batas ukuran yang diizinkan.');
    if (await db.get('SELECT id FROM attachments WHERE report_id=? AND name=? AND mime=? AND content=?', id,name,input.mime,bytes)) return getReport(user,id);
    if ((await db.get('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM attachments WHERE report_id=?', id)).n >= 5) fail(422,'Batas lima lampiran per laporan telah tercapai.');
    await db.run('INSERT INTO attachments(report_id,name,mime,size,content) VALUES(?,?,?,?,?)', id,name,input.mime,bytes.length,bytes);
    await touch(id);
    return getReport(user,id);
  });
}
export async function attachment(user,id,remove = false) {
  const item = await db.get('SELECT id,report_id,name,mime FROM attachments WHERE id=?', id);
  if (!item) fail(404,'Lampiran tidak ditemukan.');
  if (!remove) {
    await requireRow(user,item.report_id);
    return { ...item, data: Buffer.from((await db.get('SELECT content FROM attachments WHERE id=?', id)).content) };
  }
  return transaction(async () => {
    await requireEditable(user,item.report_id);
    await db.run('DELETE FROM attachments WHERE id=?', id);
    await touch(item.report_id);
    return getReport(user,item.report_id);
  });
}

const zeroCounts = () => Object.fromEntries(statuses.map(s => [s,0]));
function addPoint(points,text) {
  const compact = text.trim().replace(/\s+/g,' ');
  if (!compact || /^(?:[-–—.]|nihil|tidak ada|aman)\.?$/i.test(compact)) return;
  const brief = compact.length > 170 ? compact.slice(0,167).replace(/\s+\S*$/,'') + '…' : compact;
  if (!points.includes(brief) && points.length < 5) points.push(brief);
}
export async function summary(user, filters) {
  const date = filters.date || todayWIB();
  const groups = operational.map(division => ({
    division, count:0, points:[], obstacles:[], followUps:[], counts:zeroCounts(),
    restricted: user.role === 'staff' ? user.division !== division : !designated(user,division),
  }));
  const totals = { reports:0,...zeroCounts() };
  for (const row of await filteredRows({date,shift:filters.shift})) {
    const group = groups.find(g => g.division === row.division);
    if (!group || row.status === 'draft') continue;
    if (user.role === 'staff' && !isOwner(user,row)) continue;
    if (user.role === 'manager' && !['supervisor_approved','approved'].includes(row.status)) continue;
    group.count++;
    group.counts[row.status]++;
    totals.reports++;
    totals[row.status]++;
    if (group.restricted || row.status === 'revision') continue;
    for (const a of JSON.parse(row.activities)) {
      addPoint(group.points,a.activity + ' — ' + a.result);
      addPoint(group.obstacles,a.obstacle);
      addPoint(group.followUps,a.followUp);
    }
  }
  return { date, divisions:groups, totals };
}
