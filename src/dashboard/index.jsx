import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Boxes, CalendarDays,
  ChartNoAxesCombined, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleAlert,
  ClipboardCheck, ClipboardList, Clock3, FilePenLine, FileText, Headphones, Layers3,
  ListChecks, LoaderCircle, LockKeyhole, MessageCircle, Monitor, Network, Plus, RadioTower,
  RefreshCw, ShieldCheck, SlidersHorizontal, SprayCan, Sun, Wrench,
} from 'lucide-react';
import { api, useAuth } from '../shared.jsx';
import NetworkArt from './NetworkArt.jsx';
import './dashboard.css';

const divisionIcons = {
  NOC: RadioTower, Helpdesk: Headphones, 'Customer Service': MessageCircle,
  Teknisi: Wrench, Gudang: Boxes, 'Cleaning Service': SprayCan,
  Finance: Banknote, Accounting: ChartNoAxesCombined,
  Manajer: Layers3, Supervisor: ShieldCheck,
};
const accents = {
  NOC: 'blue', Helpdesk: 'purple', 'Customer Service': 'teal', Teknisi: 'orange',
  Gudang: 'gold', 'Cleaning Service': 'green', Finance: 'sky', Accounting: 'rose',
};
const statuses = {
  draft: ['Draf', 'muted'], submitted: ['Menunggu Supervisor', 'amber'],
  supervisor_approved: ['Menunggu Manajer', 'blue'], approved: ['Disetujui', 'green'],
  revision: ['Perlu revisi', 'red'],
};
const inJakarta = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
});
const longDate = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const time = new Date(value + 'T12:00:00Z');
  return Number.isFinite(time.getTime()) && time.toISOString().startsWith(value);
}
function useFilters() {
  const [params, setParams] = useSearchParams();
  const today = inJakarta.format(new Date());
  const date = validDate(params.get('date')) ? params.get('date') : today;
  const shift = ['Pagi', 'Siang'].includes(params.get('shift')) ? params.get('shift') : '';
  const query = new URLSearchParams({ date });
  if (shift) query.set('shift', shift);
  function change(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }
  return { date, shift, query: query.toString(), change };
}
function useDayData(query, includeReports) {
  const [state, setState] = useState({ key: '', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const { user } = useAuth();
  const key = [user?.id, query, includeReports, retry].join('|');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [summary, lists] = await Promise.all([
          api('/summary?' + query),
          includeReports ? api('/reports?' + query) : Promise.resolve({ reports: [] }),
        ]);
        if (active) setState({ key, data: { summary, reports: lists.reports }, error: '' });
      } catch (err) {
        if (active) setState({ key, data: null, error: err.message || 'Gagal memuat laporan.' });
      }
    }
    load();
    return () => { active = false; };
  }, [key, query, includeReports]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : '',
    retry: () => setRetry((value) => value + 1),
  };
}
function DateControl({ date, change }) {
  return <label className="bay-date-control">
    <CalendarDays size={15} />
    <span>{longDate.format(new Date(date + 'T12:00:00Z'))}</span>
    <ChevronDown size={13} />
    <input type="date" value={date} aria-label="Pilih tanggal laporan"
      onChange={(e) => { if (validDate(e.target.value)) change('date', e.target.value); }}
      onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* native input remains usable */ } }} />
  </label>;
}
function Heading({ title, filters, summary = false }) {
  return <header className="bay-heading">
    <div><h1>{title}</h1><DateControl {...filters} /></div>
    <div className="bay-head-actions">
      <label className="bay-shift-control"><SlidersHorizontal size={16} />
        <select value={filters.shift} aria-label="Filter shift" onChange={(e)=>filters.change('shift', e.target.value)}>
          <option value="">Semua shift</option><option>Pagi</option><option>Siang</option>
        </select><ChevronDown size={13} />
      </label>
      {!summary && <Link to="/laporan/baru" className="bay-primary-btn"><Plus size={17} />Buat laporan</Link>}
    </div>
  </header>;
}
function LoadState({ error, retry }) {
  return <div role={error ? 'alert' : 'status'} className="bay-load">
    {error ? <CircleAlert size={22} /> : <LoaderCircle size={23} className="bay-spin" />}
    <span>{error || 'Memuat laporan…'}</span>
    {error && <button type="button" onClick={retry}><RefreshCw size={15} />Coba lagi</button>}
  </div>;
}
function DivisionMark({ division, small }) {
  const Icon = divisionIcons[division] || Monitor;
  return <span className={'bay-division-mark ' + (small ? 'small ' : '') + (accents[division] || 'blue')}><Icon size={small ? 15 : 18} strokeWidth={1.8} /></span>;
}
function Status({ report }) {
  let [label, tone] = statuses[report.status] || ['Belum diketahui', 'muted'];
  if (report.status === 'submitted' && report.division === 'Supervisor') label = 'Menunggu Manajer';
  return <span className={'bay-status ' + tone}><i />{label}</span>;
}
function Metrics({ scope }) {
  const { user } = useAuth();
  const { totals, divisions } = scope;
  const lastCard = user.role === 'manager'
    ? ['Divisi ditinjau', divisions.filter(group => received(group) > 0).length, Network, 'purple']
    : ['Perlu revisi', totals.revision, FilePenLine, 'red'];
  const cards = [
    [user.role === 'staff' ? 'Laporan terkirim' : 'Laporan 8 divisi', totals.reports, FileText, 'blue'],
    ['Menunggu tinjauan', totals.submitted + totals.supervisor_approved, Clock3, 'amber'],
    ['Disetujui', totals.approved, CheckCircle2, 'green'],
    lastCard,
  ];
  return <section className="bay-kpis" aria-label={user.role === 'staff' ? 'Statistik laporan saya' : 'Statistik delapan divisi operasional'}>
    {cards.map(([label, value, Icon, tone]) => <div className="bay-kpi" key={label}>
      <span className={'bay-kpi-icon ' + tone}><Icon size={18} strokeWidth={1.9} /></span>
      <div><span className="bay-kpi-name">{label}</span><strong>{value}</strong></div>
    </div>)}
  </section>;
}
function Recent({ reports, query, isStaff }) {
  return <section className="bay-panel bay-recent">
    <div className="bay-panel-heading"><h2>{isStaff ? 'Laporan saya' : 'Laporan terbaru'}</h2><Link to={'/laporan?' + query}>Lihat semua <ArrowRight size={14} /></Link></div>
    {reports.length ? <div className="bay-report-scroll"><table className="bay-report-table">
      <thead><tr><th scope="col">Laporan</th><th scope="col">Shift</th><th scope="col">Status</th><th scope="col" aria-label="Detail"></th></tr></thead>
      <tbody>{reports.slice(0,6).map((r) => <tr key={r.id}>
        <td><Link className="bay-report-name" to={'/laporan/' + r.id}><DivisionMark division={r.division} /><span><strong>{r.activities[0]?.activity || 'Laporan ' + r.division}</strong><small>{r.division} · {r.authorName}</small></span></Link></td>
        <td><span className="bay-shift-name">{r.shift}</span></td>
        <td><Status report={r} /></td>
        <td><Link className="bay-open-report" aria-label={'Buka laporan ' + r.authorName} to={'/laporan/' + r.id}><ChevronRight size={16} /></Link></td>
      </tr>)}</tbody>
    </table></div> : <div className="bay-empty"><ClipboardList /><strong>Belum ada laporan</strong><p>Laporan yang dapat Anda buka akan tampil di sini untuk tanggal dan shift terpilih.</p><Link to="/laporan/baru">Buat laporan <ArrowRight size={14}/></Link></div>}
  </section>;
}
function OperationalNote({ groups, query }) {
  const group = groups.find(g => !g.restricted && g.obstacles.length)
    || groups.find(g => !g.restricted && g.followUps.length);
  if (!group) return null;
  const obstacle = group.obstacles[0];
  return <Link className="bay-operational-note" to={'/ringkasan?' + query + '&division=' + encodeURIComponent(group.division)}>
    <span className={'bay-note-symbol ' + (obstacle ? 'obstacle' : '')}>{obstacle ? <CircleAlert size={17}/> : <ListChecks size={17}/>}</span>
    <span className="bay-note-body"><strong>{obstacle ? 'Kendala' : 'Tindak lanjut'} · {group.division}</strong><span>{obstacle || group.followUps[0]}</span></span>
    <ChevronRight size={16} aria-hidden="true"/>
  </Link>;
}
function received(group) {
  return Math.max(0, group.count - (group.counts?.draft || 0));
}
function DivisionProgress({ groups, query, manager }) {
  const incoming = groups.filter((group)=>received(group) > 0).length;
  return <section className="bay-panel bay-divisions">
    <div className="bay-panel-heading"><h2>Progres divisi</h2><span className="bay-ratio">{incoming}<span> / {groups.length}</span></span></div>
    <div className="bay-progress-body">
      <div className="bay-segments" aria-hidden="true">{groups.map((g)=><i key={g.division} className={received(g)>0 ? 'filled' : ''}/>)}</div>
      <p>{manager ? 'Divisi yang telah ditinjau Supervisor' : 'Divisi yang sudah mengirim laporan'}</p>
      <ul>{groups.map((g)=><li key={g.division}><Link to={'/ringkasan?' + query + '&division=' + encodeURIComponent(g.division)}><span><DivisionMark small division={g.division} />{g.division}</span>
        <span className={'bay-dot-label ' + (received(g) ? 'in' : '')}><i />{received(g) ? (manager ? 'Ditinjau' : 'Masuk') : 'Belum masuk'}</span></Link></li>)}</ul>
      <Link className="bay-summary-link" to={'/ringkasan?' + query}>Buka ringkasan divisi <ArrowRight size={14} /></Link>
    </div>
  </section>;
}
export function Dashboard() {
  const { user } = useAuth();
  const filters = useFilters();
  const { data, error, retry } = useDayData(filters.query, true);
  const staff = user.role === 'staff';
  const groups = data?.summary.divisions || [];
  const recent = data?.reports || [];
  const incoming = groups.filter((group) => received(group) > 0).length;
  const queue = recent.filter((r) => r.canReview).length;
  const ownDrafts = recent.filter((r) => r.authorId === user.id && r.status === 'draft').length;
  return <div className="bay-dash">
    <Heading title="Dasbor harian" filters={filters} />
    {!data ? <LoadState error={error} retry={retry}/> : <>
      <section className="bay-hero">
        <NetworkArt/>
        <div className="bay-hero-copy">
          <span className="bay-hero-caption"><Sun size={15} />{filters.shift ? 'Shift ' + filters.shift.toLowerCase() : 'Shift pagi dan siang'}</span>
          <h2>{staff ? 'Ringkasan laporan saya' : 'Ringkasan operasional'}</h2>
          <p>{staff ? (ownDrafts ? ownDrafts + ' draf Anda menunggu untuk dilengkapi.' : 'Anda memiliki ' + recent.length + ' laporan pada periode ini.') : incoming + ' dari ' + groups.length + ' divisi ' + (user.role === 'manager' ? 'telah melalui tinjauan Supervisor.' : 'telah mengirim laporan.')}{!staff && queue > 0 && <span> {queue} laporan menunggu tinjauan Anda.</span>}</p>
          <Link to={'/ringkasan?' + filters.query}>Lihat ringkasan <ArrowRight size={15} /></Link>
        </div>
      </section>
      <Metrics scope={data.summary} />
      <div className="bay-lower">
        <div className="bay-day-feed">{!staff && <OperationalNote groups={groups} query={filters.query}/>}<Recent reports={recent} query={filters.query} isStaff={staff}/></div>
        {staff ? <section className="bay-panel bay-work">
          <div className="bay-panel-heading"><h2>Tindak lanjut saya</h2><ListChecks size={18}/></div>
          <div>{recent.filter(r => r.canEdit).length ? recent.filter(r => r.canEdit).slice(0,5).map(r =>
            <Link key={r.id} to={'/laporan/' + r.id + '/edit'}><span><strong>{r.status === 'revision' ? 'Perbaiki laporan' : 'Lanjutkan draf'}</strong><small>{r.division} · Shift {r.shift}</small></span><ChevronRight size={16} /></Link>) : <div className="bay-empty"><CheckCheck /><p>Semua tindak lanjut Anda selesai untuk periode ini.</p></div>}</div>
        </section> : <DivisionProgress groups={groups} query={filters.query} manager={user.role === 'manager'} />}
      </div>
    </>}
  </div>;
}
function BulletGroup({ title, entries, Icon, tone }) {
  if (!entries?.length) return null;
  return <div className={'bay-bullets ' + tone}><h3><Icon size={15}/>{title}</h3><ul>{entries.map((entry,i)=><li key={i}>{entry}</li>)}</ul></div>;
}
function SummaryGroup({ group, query, summaryOnly }) {
  return <article className="bay-panel bay-summary-card">
    <div className="bay-group-title"><DivisionMark division={group.division} /><div><h2>{group.division}</h2><small>{group.count} laporan</small></div>
      {group.restricted && <span className="bay-lock" title="Rincian dibatasi"><LockKeyhole size={16}/></span>}
    </div>
    {group.restricted ? <p className="bay-group-empty">Rincian tersedia untuk peninjau yang ditugaskan.</p> :
      <>
        <BulletGroup title="Hasil utama" Icon={ClipboardCheck} entries={group.points} tone="blue"/>
        <BulletGroup title="Kendala" Icon={CircleAlert} entries={group.obstacles} tone="amber"/>
        <BulletGroup title="Tindak lanjut" Icon={ArrowDownRight} entries={group.followUps} tone="green"/>
        {!group.points.length && !group.obstacles.length && !group.followUps.length && <p className="bay-group-empty">{group.count ? 'Belum ada poin laporan pada tahap ini.' : 'Belum ada laporan untuk periode ini.'}</p>}
        {!summaryOnly && group.count > 0 && <Link className="bay-group-link" to={'/laporan?' + query + '&division=' + encodeURIComponent(group.division)}>Lihat laporan <ArrowUpRight size={14}/></Link>}
      </>}
  </article>;
}
export function Summary() {
  const { user } = useAuth();
  const filters = useFilters();
  const { data, error, retry } = useDayData(filters.query, false);
  const [params] = useSearchParams();
  const staff = user.role === 'staff';
  const groups = (data?.summary.divisions || []).filter(g => !staff || g.division === user.division);
  const selected = groups.some(g => g.division === params.get('division')) ? params.get('division') : '';
  const visible = groups.filter(g => !selected || g.division === selected);
  return <div className="bay-dash">
    <Heading title="Ringkasan harian" filters={filters} summary/>
    {!data ? <LoadState error={error} retry={retry}/> : <>
      <section className="bay-summary-banner"><span className="bay-summary-icon"><Layers3 size={24}/></span><div>
        <h2>{user.role === 'director' ? 'Ringkasan Manajer dan Supervisor' : staff ? 'Ringkasan ' + user.division : 'Ringkasan delapan divisi'}</h2>
        <p>{user.role === 'director' ? 'Hasil, kendala, dan tindak lanjut dari laporan pimpinan yang sudah dikirim.' : user.role === 'manager' ? 'Poin utama dari laporan yang sudah ditinjau Supervisor.' : staff ? 'Hasil, kendala, dan tindak lanjut dari laporan Anda.' : 'Hasil, kendala, dan tindak lanjut dari laporan yang masuk ke tahap Supervisor.'}</p>
      </div></section>
      {user.role !== 'director' && <Metrics scope={data.summary}/>}
      <div className="bay-group-heading"><h2>{staff ? 'Poin utama saya' : 'Poin utama per divisi'}</h2>
        {!staff && <label className="bay-shift-control"><SlidersHorizontal size={15}/><select aria-label="Pilih divisi" value={selected} onChange={(e)=>filters.change('division',e.target.value)}><option value="">Semua divisi</option>{groups.map(g=><option key={g.division}>{g.division}</option>)}</select><ChevronDown size={13}/></label>}
      </div>
      <section className="bay-summary-grid">{visible.map(g=><SummaryGroup summaryOnly={user.role === 'director'} key={g.division} group={g} query={filters.query}/>)}</section>
    </>}
  </div>;
}
