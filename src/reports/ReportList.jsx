import React, { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, FilePlus2, Files, ListFilter, Search, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../shared.jsx';
import { divisions, Loading, Notice, prettyDate, Status, statuses, useRemote } from './common.jsx';

const filterLabels = { submitted: 'Dikirim', supervisor_approved: 'Disetujui Supervisor' };

export default function ReportList() {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const selected = (key) => params.get(key) || '';
  const mine = selected('mine') === '1';
  const review = selected('review') === '1';
  const isDrafts = mine && selected('status') === 'draft';
  const hasFilters = ['date', 'shift', 'division', 'status'].some(k => selected(k));
  const [showFilters, setShowFilters] = useState(hasFilters);
  const [query, setQuery] = useState('');
  const apiParams = new URLSearchParams();
  for (const key of ['date', 'shift', 'division', 'status', 'mine']) {
    if (selected(key)) apiParams.set(key, selected(key));
  }
  const { data, loading, error, refresh } = useRemote('/reports?' + apiParams, user?.id);
  const reports = (data?.reports || []).filter(report => {
    if (review && !report.canReview) return false;
    const searchable = [report.division, report.authorName, report.date, ...report.activities.map(row => row.activity)].join(' ').toLocaleLowerCase('id');
    return searchable.includes(query.trim().toLocaleLowerCase('id'));
  });
  function change(values) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  const reset = () => { setQuery(''); change({ date: '', shift: '', division: '', status: isDrafts ? 'draft' : '' }); };
  const title = isDrafts ? 'Draf saya' : review ? 'Tinjauan laporan' : mine ? 'Laporan saya' : 'Daftar laporan';
  const subtitle = isDrafts ? 'Lanjutkan laporan yang masih Anda susun.' : review ? 'Periksa laporan yang menunggu keputusan Anda.' : 'Telusuri aktivitas, hasil kerja, dan status laporan harian.';
  return <div className="br-page">
    <header className="br-heading"><div><h1>{title}</h1><p>{subtitle}</p></div><Link className="br-btn br-primary" to="/laporan/baru"><FilePlus2 size={17}/> Buat laporan</Link></header>
    {location.state?.notice && <div className="br-success" role="status"><CheckCircle2 size={16}/>{location.state.notice}</div>}
    <section className="br-card br-list-card" aria-label="Daftar laporan">
      <div className="br-list-toolbar"><label className="br-search"><Search size={18}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari aktivitas, divisi, atau pelapor" aria-label="Cari laporan"/></label>
        <button className={'br-btn br-secondary' + (showFilters ? ' br-selected' : '')} type="button" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}><ListFilter size={16}/>Filter{hasFilters && <i className="br-filter-dot"/>}</button>
      </div>
      {showFilters && <div className="br-filters">
        <label>Tanggal<input type="date" value={selected('date')} onChange={e => change({ date: e.target.value })}/></label>
        <label>Shift<select value={selected('shift')} onChange={e => change({ shift: e.target.value })}><option value="">Semua shift</option><option>Pagi</option><option>Siang</option></select></label>
        <label>Divisi<select value={selected('division')} onChange={e => change({ division: e.target.value })}><option value="">Semua divisi</option>{divisions.map(name => <option key={name}>{name}</option>)}</select></label>
        {!isDrafts && <label>Status<select value={selected('status')} onChange={e => change({ status: e.target.value })}><option value="">Semua status</option>{Object.entries(statuses).map(([value, info]) => <option key={value} value={value}>{filterLabels[value] || info.label}</option>)}</select></label>}
      </div>}
      <div className="br-list-meta"><strong>{loading ? 'Daftar laporan' : reports.length + ' laporan'}</strong>{(query || (hasFilters && !isDrafts) || (isDrafts && ['date','division','shift'].some(k => selected(k)))) && <button className="br-text-btn" type="button" onClick={reset}><X size={13}/> Hapus filter</button>}</div>
      {loading ? <Loading/> : error ? <Notice retry={refresh}>{error}</Notice> : reports.length === 0 ? <div className="br-empty"><span><Files size={26}/></span><h3>{review ? 'Tidak ada laporan untuk ditinjau' : 'Belum ada laporan'}</h3><p>{query || hasFilters ? 'Coba ubah filter atau kata pencarian.' : review ? 'Laporan akan muncul setelah siap untuk Anda periksa.' : 'Laporan yang dapat Anda akses akan muncul di sini.'}</p>{!review && !query && !hasFilters && <Link className="br-text-btn" to="/laporan/baru">Buat laporan pertama <ArrowRight size={14}/></Link>}</div>
      : <div className="br-report-rows">
        <div className="br-report-row br-table-head" aria-hidden="true"><span>Laporan</span><span>Divisi</span><span>Tanggal &amp; shift</span><span>Status</span><span/></div>
        {reports.map(report => <Link to={'/laporan/' + report.id} key={report.id} className="br-report-row br-row-link">
          <span className="br-report-title"><strong>{report.activities[0]?.activity || 'Draf laporan ' + report.division}</strong><small>{report.authorName}</small></span>
          <span className="br-report-div">{report.division}</span>
          <span className="br-report-date"><span><CalendarDays size={13}/>{prettyDate(report.date)}</span><small>Shift {report.shift}</small></span>
          <span><Status value={report.status} division={report.division}/></span><ChevronRight className="br-row-arrow" size={16}/>
        </Link>)}
      </div>}
    </section>
  </div>;
}
