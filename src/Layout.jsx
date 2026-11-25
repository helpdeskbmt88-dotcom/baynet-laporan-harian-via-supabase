import { useEffect, useRef, useState } from 'react'
import { ChartNoAxesCombined, ChevronRight, ClipboardCheck, Clock3, Files, LayoutDashboard, LogOut, Menu, NotebookPen, PanelLeftClose } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './shared.jsx'

const sections = [
  { label: 'Ruang kerja', links: [
    { to: '/', title: 'Dasbor harian', icon: LayoutDashboard },
    { to: '/laporan', title: 'Daftar laporan', icon: Files },
    { to: '/ringkasan', title: 'Ringkasan harian', icon: ChartNoAxesCombined },
  ] },
  { label: 'Aktivitas saya', links: [
    { to: '/laporan?mine=1&status=draft', title: 'Draf saya', icon: NotebookPen },
    { to: '/laporan?review=1', title: 'Tinjauan laporan', icon: ClipboardCheck, reviewer: true },
  ] },
]
const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
function JakartaTime() {
  const [now, setNow] = useState(()=>new Date())
  useEffect(()=>{const timer = window.setInterval(()=>setNow(new Date()), 15000); return ()=>clearInterval(timer)}, [])
  return <span className="jakarta-time"><Clock3 size={14}/>{timeFormat.format(now)} WIB</span>
}
export default function Layout() {
  const { user, logout } = useAuth()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [notice, setNotice] = useState('')
  const menu = useRef(null)
  const mobileClose = useRef(null)
  const side = useRef(null)
  const params = new URLSearchParams(search)
  const active = pathname === '/laporan' && params.get('mine') === '1' && params.get('status') === 'draft' ? '/laporan?mine=1&status=draft'
    : pathname === '/laporan' && params.get('review') === '1' ? '/laporan?review=1'
    : pathname.startsWith('/laporan') ? '/laporan' : pathname
  const title = pathname === '/laporan/baru' ? 'Buat laporan' : pathname.endsWith('/edit') ? 'Ubah laporan' : /^\/laporan\/\d+$/.test(pathname) ? 'Detail laporan' : sections.flatMap(s=>s.links).find(item=>item.to === active)?.title || 'Ruang kerja'

  useEffect(()=>{setOpen(false); setNotice(''); window.scrollTo(0,0)}, [pathname,search])
  useEffect(()=>{document.title = title + ' · BAYNET'}, [title])
  useEffect(()=>{
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    mobileClose.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') { setOpen(false); menu.current?.focus() }
      if (event.key !== 'Tab' || !side.current) return
      const nodes = [...side.current.querySelectorAll('a,button:not(:disabled)')].filter(el=>el.offsetParent !== null)
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
    }
    const desktop = window.matchMedia('(min-width: 941px)')
    const resize = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change',resize)
    window.addEventListener('keydown',onKey)
    return ()=>{document.body.style.overflow=previous; window.removeEventListener('keydown',onKey); desktop.removeEventListener('change',resize)}
  },[open])
  async function signOut() {
    setExiting(true)
    try { await logout() } catch (err) { setNotice(err.message) }
    finally { setExiting(false) }
  }
  const initials = user.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')
  return <div className={'workspace' + (open ? ' menu-open' : '')}>
    <a className="skip-link" href="#main-content">Langsung ke konten</a>
    {open && <button className="side-scrim" onClick={()=>{setOpen(false);menu.current?.focus()}} aria-label="Tutup navigasi" tabIndex={-1}/>}
    <aside className="sidebar" id="main-navigation" ref={side} aria-label="Menu ruang kerja">
      <div className="side-brand"><Link to="/" aria-label="BAYNET, dasbor"><img src="/baynet-logo.png" width="146" height="42" alt="BAYNET"/></Link><button ref={mobileClose} className="mobile-close" onClick={()=>{setOpen(false);menu.current?.focus()}} aria-label="Tutup menu"><PanelLeftClose size={21}/></button></div>
      <nav className="app-navigation">{sections.map(group=><div className="nav-section" key={group.label}>
        <h2>{group.label}</h2>
        {group.links.filter(item=>!item.reviewer || user.role !== 'staff').map(({to,title:label,icon:Icon})=><Link key={to} to={to} onClick={()=>setOpen(false)} aria-current={active === to ? 'page' : undefined} className={active === to ? 'selected' : ''}><Icon size={18}/><span>{label}</span>{active === to && <ChevronRight className="active-arrow" size={14}/>}</Link>)}
      </div>)}</nav>
      <div className="side-account">
        {notice && <div role="alert" className="app-error">{notice}</div>}
        <div className="account-row"><span className="avatar-initials">{initials}</span><span className="account-name"><strong>{user.name}</strong><small>{user.division}</small></span><button type="button" className="exit-button" title="Keluar dari akun" aria-label="Keluar dari akun" disabled={exiting} onClick={signOut}><LogOut size={17}/></button></div>
      </div>
    </aside>
    <div className="work-column">
      <header className="app-header"><div className="work-breadcrumb"><button ref={menu} type="button" className="mobile-menu" aria-label="Buka menu" aria-expanded={open} aria-controls="main-navigation" onClick={()=>setOpen(true)}><Menu size={21}/></button><span>Ruang kerja</span><ChevronRight size={14}/><strong>{title}</strong></div><JakartaTime/></header>
      <main id="main-content" className="work-main"><Outlet/></main>
    </div>
  </div>
}
