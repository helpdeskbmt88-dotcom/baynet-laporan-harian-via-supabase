import React, { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ClipboardList, Clock3, Download, FileText, History, MessageSquareText, Paperclip, PencilLine, RotateCcw, Send, Trash2, UserRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useAuth } from '../shared.jsx';
import { Back, details, errorMessage, fileSize, Loading, Notice, prettyDate, Status, statusLabel, timestamp, useRemote } from './common.jsx';

function briefPoints(rows, select) {
  const selected = [];
  for (const row of rows) {
    const point = select(row).trim().replace(/\s+/g, ' ');
    if (!point || /^(?:[-—–.]|nihil|tidak ada|aman)\.?$/i.test(point) || selected.includes(point)) continue;
    selected.push(point);
  }
  return selected.slice(0, 3).map(point => point.length > 150 ? point.slice(0, 147).replace(/\s+\S*$/, '') + '…' : point);
}
function ReportReview({ report, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(action) {
    if (action === 'revise' && !note.trim()) {
      setError('Tulis catatan agar pelapor tahu bagian yang perlu diperbaiki.');
      return;
    }
    setBusy(true); setError('');
    try {
      await api('/reports/' + report.id + '/review', { method: 'POST', body: { action, note: note.trim(), version: report.version } });
      onDone(action);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="br-card br-panel">
    <h2><ClipboardList size={19}/>Ringkasan untuk tinjauan</h2>
    <div className="br-review-summary">{[
      ['Hasil utama', briefPoints(report.activities, row => row.activity + ' — ' + row.result)],
      ['Kendala', briefPoints(report.activities, row => row.obstacle || '')],
      ['Tindak lanjut', briefPoints(report.activities, row => row.followUp || '')],
    ].map(([label, points]) => <div key={label}><h3>{label}</h3>{points.length ? <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul> : <p>Belum dicatat.</p>}</div>)}</div>
    <h2 className="br-review-action-title"><MessageSquareText size={18}/>Keputusan tinjauan</h2>
    <label className="br-field"><span>Catatan peninjau</span><textarea rows="3" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Wajib diisi jika meminta revisi"/></label>
    {error && <Notice>{error}</Notice>}
    <div className="br-buttons"><button className="br-btn br-primary" disabled={busy} onClick={() => decide('approve')}><Check size={16}/>{report.status === 'submitted' && report.division !== 'Supervisor' ? 'Setujui & teruskan' : 'Setujui laporan'}</button>
      <button className="br-btn br-secondary" disabled={busy} onClick={() => decide('revise')}><RotateCcw size={15}/>Minta revisi</button></div>
  </section>;
}
function ActivityRow({ row, index, division }) {
  const info = [['Hasil', row.result], ['Kendala', row.obstacle], ['Tindak lanjut', row.followUp], [details[division]?.[0] || 'Keterangan', row.detail]];
  return <details className="br-activity-detail" open={index === 0}>
    <summary><span className="br-index">{index + 1}</span><strong>{row.activity || 'Aktivitas belum diisi'}</strong><ChevronDown size={15}/></summary>
    <dl className="br-defs">{info.filter(([, v]) => v).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
  </details>;
}
function WorkEntries({ report }) {
  const entries = report.activities.map((row, i) => <ActivityRow row={row} index={i} division={report.division} key={i}/>);
  if (report.canReview) return <details className="br-card br-source-report"><summary><ClipboardList size={18}/><strong>Rincian aktivitas ({entries.length})</strong><ChevronDown size={16}/></summary><div>{entries}</div></details>;
  return <section className="br-card br-panel"><div className="br-section-heading"><h2><ClipboardList size={19}/>Aktivitas kerja</h2><span className="br-muted">{entries.length} aktivitas</span></div>
    {entries.length ? entries : <p className="br-muted">Draf ini belum berisi aktivitas.</p>}
  </section>;
}
export default function ReportDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useRemote('/reports/' + encodeURIComponent(id), user?.id);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const report = data?.report;
  async function commit(action) {
    setBusy(true); setMessage('');
    try {
      if (action === 'delete') {
        await api('/reports/' + report.id, { method: 'DELETE', body: { version: report.version } });
        navigate('/laporan?mine=1&status=draft', { replace: true });
      } else {
        await api('/reports/' + report.id + '/submit', { method: 'POST', body: { version: report.version } });
        refresh();
      }
    } catch (err) { setMessage(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="br-page"><Back/>
    {loading ? <Loading/> : error ? <Notice retry={refresh}>{error}</Notice> : !report ? null : <>
      <header className="br-heading"><div><h1>Laporan {report.division}</h1><p>{prettyDate(report.date, true)} · Shift {report.shift}</p></div><Status value={report.status} division={report.division}/></header>
      {message && <Notice retry={() => { setMessage(''); refresh(); }}>{message}</Notice>}
      <div className="br-layout">
        <div className="br-stack">
          {report.canReview && <ReportReview report={report} onDone={action => navigate('/laporan?review=1', { state: { notice: action === 'revise' ? 'Permintaan revisi telah dikirim kepada pelapor.' : 'Laporan telah disetujui.' } })}/>}
          <WorkEntries report={report}/>
          {report.attachments.length > 0 && <section className="br-card br-panel"><h2><Paperclip size={18}/>Bukti terlampir</h2><div className="br-file-list">{report.attachments.map(file => <a key={file.id} href={'/api/attachments/' + file.id} download={file.name} className="br-file"><FileText size={18}/><span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span><Download size={15}/></a>)}</div></section>}
          {report.canEdit && <section className="br-card br-panel"><h2><PencilLine size={18}/>Kelola laporan</h2>
            {report.status === 'revision' && [...report.history].reverse().find(e => e.note)?.note && <p className="br-revision-note"><strong>Catatan revisi</strong>{[...report.history].reverse().find(e => e.note)?.note}</p>}
            <div className="br-buttons"><Link className="br-btn br-secondary" to={'/laporan/' + report.id + '/edit'}><PencilLine size={15}/>Ubah laporan</Link>
            <button type="button" className="br-btn br-primary" disabled={busy} onClick={() => commit('submit')}><Send size={15}/>Kirim laporan</button>
            {report.canDelete && <button type="button" className="br-icon-btn br-danger" title="Hapus draf" aria-label="Hapus draf" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={16}/></button>}</div>
            {confirmDelete && <div className="br-confirm"><strong>Hapus draf beserta buktinya?</strong><div className="br-buttons"><button disabled={busy} type="button" className="br-btn br-danger-btn" onClick={() => commit('delete')}>Ya, hapus draf</button><button disabled={busy} type="button" className="br-btn br-secondary" onClick={() => setConfirmDelete(false)}>Batal</button></div></div>}
          </section>}
        </div>
        <aside className="br-stack">
          <section className="br-card br-panel"><h2>Informasi laporan</h2><dl className="br-metadata">
            <div><dt><UserRound size={15}/>Pelapor</dt><dd>{report.authorName}</dd></div><div><dt><CalendarDays size={15}/>Tanggal</dt><dd>{prettyDate(report.date, true)}</dd></div><div><dt><Clock3 size={15}/>Shift</dt><dd>{report.shift}</dd></div>
          </dl></section>
          <section className="br-card br-panel"><h2><History size={18}/>Riwayat laporan</h2><ol className="br-history">{[...report.history].reverse().map((event, index) => <li key={index}><strong>{statusLabel(event.status, report.division)}</strong><span>{event.by} · {timestamp(event.at)}</span>{event.note && <p>{event.note}</p>}</li>)}</ol></section>
        </aside>
      </div>
    </>}
  </div>;
}
