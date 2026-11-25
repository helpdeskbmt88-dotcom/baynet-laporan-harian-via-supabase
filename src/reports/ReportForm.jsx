import React, { useRef, useState } from 'react';
import { CalendarDays, Check, ClipboardList, FilePlus2, FileText, LoaderCircle, Paperclip, Plus, Save, Send, Sun, Sunset, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, api } from '../shared.jsx';
import { Back, details, errorMessage, evidenceDivisions, fileSize, Loading, Notice, useRemote, wibDate } from './common.jsx';

const emptyActivity = () => ({ activity: '', result: '', obstacle: '', followUp: '', detail: '' });
const accepted = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
function fileMime(file) {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  return Object.keys(accepted).find(type => accepted[type] === ext || (ext === 'jpeg' && accepted[type] === 'jpg')) || '';
}
function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Berkas gagal dibaca. Pilih kembali berkas bukti.'));
    reader.readAsDataURL(file);
  });
}
function ActivityEditor({ row, index, division, update, remove, canRemove }) {
  const [field, placeholder] = details[division] || ['Keterangan divisi', 'Tambahkan keterangan'];
  return <fieldset className="br-activity-editor"><legend className="br-sr">Aktivitas {index + 1}</legend>
    <div className="br-activity-heading"><strong>Aktivitas {index + 1}</strong>{canRemove && <button className="br-icon-btn br-danger" type="button" onClick={remove} aria-label={'Hapus aktivitas ' + (index + 1)}><Trash2 size={15}/></button>}</div>
    <label className="br-field"><span>Aktivitas <em>*</em></span><input value={row.activity} onChange={e => update('activity', e.target.value)} maxLength={1000} placeholder="Pekerjaan yang dilakukan" /></label>
    <label className="br-field"><span>Hasil kerja <em>*</em></span><textarea rows={2} value={row.result} onChange={e => update('result', e.target.value)} maxLength={1000} placeholder="Hasil yang dicapai atau kondisi terakhir" /></label>
    <div className="br-form-grid"><label className="br-field"><span>Kendala</span><textarea rows={2} value={row.obstacle} onChange={e => update('obstacle', e.target.value)} maxLength={1000} placeholder="Jika ada"/></label>
      <label className="br-field"><span>Tindak lanjut</span><textarea rows={2} value={row.followUp} onChange={e => update('followUp', e.target.value)} maxLength={1000} placeholder="Langkah berikutnya"/></label></div>
    <label className="br-field"><span>{field}</span><input value={row.detail} onChange={e => update('detail', e.target.value)} maxLength={1000} placeholder={placeholder}/></label>
  </fieldset>;
}
function Editor({ initial, user, meta }) {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(initial);
  const [date, setDate] = useState(initial?.date || meta?.today || wibDate());
  const [shift, setShift] = useState(initial?.shift || (search.get('shift') === 'Siang' ? 'Siang' : 'Pagi'));
  const [rows, setRows] = useState(() => initial?.activities?.length ? initial.activities.map(row => ({ ...emptyActivity(), ...row })) : [emptyActivity()]);
  const [files, setFiles] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [recoveryPath, setRecoveryPath] = useState('');
  const lock = useRef(false);
  const messageRef = useRef(null);
  const uploadRef = useRef(null);
  const shownFiles = (record?.attachments || []).filter(f => !removed.includes(f.id));
  const division = initial?.division || user.division;
  const mayAttach = (meta?.attachmentDivisions || evidenceDivisions).includes(division);
  const daily = (meta?.regularDivisions || ['Manajer', 'Supervisor', 'Finance', 'Accounting']).includes(division);
  function changeRow(index, key, value) { setRows(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  function pickFiles(event) {
    const chosen = Array.from(event.target.files);
    event.target.value = '';
    setFileError('');
    if (files.length + shownFiles.length + chosen.length > 5) { setFileError('Maksimal 5 berkas per laporan.'); return; }
    for (const file of chosen) {
      if (!Object.hasOwn(accepted, fileMime(file)) || file.size > 3 * 1024 * 1024 || file.size === 0) {
        setFileError('Berkas “' + file.name + '” harus berupa JPG, PNG, WebP atau PDF berukuran maksimal 3 MB dan berisi data.'); return;
      }
    }
    setFiles(previous => [...previous, ...chosen]);
  }
  function showError(message) {
    setError(message);
    requestAnimationFrame(() => messageRef.current?.focus());
  }
  async function persist(submit) {
    if (lock.current) return;
    setError(''); setRecoveryPath('');
    if (!date) { showError('Pilih tanggal kerja untuk laporan ini.'); return; }
    if (submit && date > wibDate()) { showError('Laporan untuk tanggal mendatang dapat disimpan sebagai draf.'); return; }
    const activities = rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()])));
    if (submit && activities.some(row => !row.activity || !row.result)) {
      showError('Isi aktivitas dan hasil kerja pada setiap baris sebelum mengirim laporan.'); return;
    }
    lock.current = true; setBusy(submit ? 'submit' : 'save');
    let saved = record;
    try {
      const body = { date, shift, activities, ...(saved && { version: saved.version }) };
      ({ report: saved } = await api(saved ? '/reports/' + saved.id : '/reports', { method: saved ? 'PUT' : 'POST', body }));
      setRecord(saved);
      for (const id of removed) {
        ({ report: saved } = await api('/attachments/' + id, { method: 'DELETE' }));
        setRecord(saved); setRemoved(previous => previous.filter(item => item !== id));
      }
      for (const file of files) {
        const data = await encodeFile(file);
        ({ report: saved } = await api('/reports/' + saved.id + '/attachments', { method: 'POST', body: { name: file.name, mime: fileMime(file), data } }));
        setRecord(saved); setFiles(previous => previous.filter(item => item !== file));
      }
      if (submit) await api('/reports/' + saved.id + '/submit', { method: 'POST', body: { version: saved.version } });
      navigate('/laporan/' + saved.id, { replace: true });
    } catch (err) {
      const fields = err.fields && Object.values(err.fields).filter(v => typeof v === 'string').join(' ');
      showError([errorMessage(err), fields].filter(Boolean).join(' '));
      setRecoveryPath(saved ? '/laporan/' + saved.id : '/laporan?' + new URLSearchParams({ mine: '1', date, ...(daily ? {} : { shift }) }));
    } finally { lock.current = false; setBusy(''); }
  }
  const backTo = record ? '/laporan/' + record.id : '/laporan';
  return <div className="br-page"><Back to={backTo}>{record ? 'Detail laporan' : 'Daftar laporan'}</Back>
    <header className="br-heading"><div><h1>{initial ? 'Ubah laporan' : 'Buat laporan harian'}</h1><p>{user.name} · {division}</p></div></header>
    <div ref={messageRef} tabIndex={-1} className="br-error-anchor">{error && <Notice>{error}{recoveryPath && <> <Link to={recoveryPath}>{record ? 'Buka versi tersimpan.' : 'Periksa laporan pada tanggal ini.'}</Link></>}</Notice>}</div>
    <form className="br-edit-form" onSubmit={e => { e.preventDefault(); persist(true); }} noValidate>
      <fieldset className="br-plain-fieldset" disabled={Boolean(busy)}>
        <section className="br-card br-panel"><h2><CalendarDays size={19}/>Waktu pelaporan</h2>
          <div className="br-form-grid"><label className="br-field"><span>Tanggal kerja <em>*</em></span><input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
            <fieldset className="br-shift"><legend>Shift kerja <em>*</em></legend><div>{[['Pagi', Sun], ['Siang', Sunset]].map(([name, Icon]) => <label className={shift === name ? 'br-chosen' : ''} key={name}><input type="radio" name="shift" value={name} checked={shift === name} onChange={() => setShift(name)}/><Icon size={16}/>{name}{shift === name && <Check size={13}/>}</label>)}</div></fieldset>
          </div><p className="br-hint">{daily ? 'Divisi Anda mengisi satu laporan per tanggal kerja.' : 'Isi satu laporan untuk setiap shift kerja Anda.'} Tanggal mengikuti WIB.</p>
        </section>
        <section className="br-card br-panel"><h2><ClipboardList size={19}/>Aktivitas kerja</h2>
          {rows.map((row,index) => <ActivityEditor row={row} index={index} division={division} update={(key, value) => changeRow(index, key, value)} canRemove={rows.length > 1} remove={() => setRows(prev => prev.filter((_, i) => i !== index))} key={index}/>)}
          <button className="br-btn br-add" type="button" disabled={rows.length >= 30} onClick={() => setRows(prev => [...prev, emptyActivity()])}><Plus size={16}/>Tambah aktivitas</button>
        </section>
        {mayAttach && <section className="br-card br-panel"><h2><Paperclip size={18}/>Lampiran bukti</h2>
          <div className="br-file-list">{shownFiles.map(file => <div className="br-file" key={file.id}><FileText size={18}/><span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span><button type="button" className="br-icon-btn br-danger" onClick={() => setRemoved(previous => [...previous, file.id])} aria-label={'Hapus ' + file.name}><Trash2 size={15}/></button></div>)}
          {files.map((file, i) => <div className="br-file" key={i}><FilePlus2 size={18}/><span><strong>{file.name}</strong><small>{fileSize(file.size)} · Siap diunggah</small></span><button type="button" className="br-icon-btn br-danger" onClick={() => setFiles(previous => previous.filter((_, index) => index !== i))} aria-label={'Batalkan ' + file.name}><Trash2 size={15}/></button></div>)}</div>
          {fileError && <Notice>{fileError}</Notice>}
          {shownFiles.length + files.length < 5 && <button type="button" className="br-upload" onClick={() => uploadRef.current?.click()}><Upload size={21}/><strong>Pilih berkas bukti</strong><small>JPG, PNG, WebP atau PDF · Maks. 3 MB per berkas · Hingga 5 berkas</small></button>}
          <input type="file" ref={uploadRef} accept=".png,.jpg,.jpeg,.webp,.pdf" multiple hidden onChange={pickFiles}/>
        </section>}
        <div className="br-form-actions"><button type="button" className="br-btn br-secondary" onClick={() => persist(false)}>{busy === 'save' ? <LoaderCircle className="br-spin" size={16}/> : <Save size={16}/>}{record?.status === 'revision' ? 'Simpan perubahan' : 'Simpan draf'}</button><button type="submit" className="br-btn br-primary">{busy === 'submit' ? <LoaderCircle className="br-spin" size={16}/> : <Send size={16}/>}Kirim laporan</button></div>
      </fieldset>
    </form>
  </div>;
}
export default function ReportForm() {
  const { id } = useParams();
  const { user, meta } = useAuth();
  const { data, error, loading, refresh } = useRemote(id ? '/reports/' + encodeURIComponent(id) : null, user?.id);
  if (id && loading) return <Loading/>;
  if (id && error) return <div className="br-page"><Back/><Notice retry={refresh}>{error}</Notice></div>;
  if (id && !data?.report?.canEdit) return <div className="br-page"><Back/><Notice>Laporan ini sudah dikirim atau berada di luar akses Anda.</Notice></div>;
  return <Editor key={String(user.id) + '/' + (id || 'new')} initial={id ? data.report : null} user={user} meta={meta}/>;
}
