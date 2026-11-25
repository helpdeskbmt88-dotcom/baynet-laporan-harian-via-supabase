import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import '@fontsource-variable/dm-sans'
import './style.css'
import { api, AuthContext } from './shared.jsx'
import Login from './Login.jsx'
import Layout from './Layout.jsx'
import { Dashboard, Summary } from './dashboard/index.jsx'
import { ReportList, ReportForm, ReportDetail } from './reports/index.jsx'

function App() {
  const [user, setUser] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()
  useEffect(()=>{
    let active = true
    setLoading(true); setError('')
    Promise.all([api('/meta'), api('/me').catch(err=>{if (err.status === 401) return { user:null }; throw err})])
      .then(([config,session])=>{if (active) {setMeta(config);setUser(session.user)}})
      .catch(err=>{if (active) setError(err.message)})
      .finally(()=>{if (active) setLoading(false)})
    return ()=>{active=false}
  },[attempt])
  useEffect(()=>{
    const onExpired = () => setExpired(true)
    window.addEventListener('baynet:expired',onExpired)
    return ()=>window.removeEventListener('baynet:expired',onExpired)
  },[])
  const login = useCallback(async credentials=>{
    const res = await api('/login',{method:'POST',body:credentials})
    setUser(res.user); setExpired(false)
  },[])
  async function logout() {
    await api('/logout',{method:'POST'})
    setUser(null); setExpired(false); navigate('/',{replace:true})
  }
  useEffect(()=>{if (!user) document.title = 'Masuk · Laporan Harian BAYNET'},[user])
  if (loading || error) return <main className="boot-screen"><img src="/baynet-logo.png" alt="BAYNET"/>{loading ? <p role="status"><LoaderCircle size={18} className="app-spin"/> Membuka ruang kerja…</p> : <><p role="alert">{error}</p><button className="boot-retry" onClick={()=>setAttempt(value=>value+1)}>Coba lagi</button></>}</main>
  return <AuthContext.Provider value={{user,meta,login,logout}}>
    {!user ? <Login/> : <>
      <div inert={expired || undefined} aria-hidden={expired || undefined}><Routes>
        <Route element={<Layout/>}>
          <Route index element={<Dashboard/>}/>
          <Route path="ringkasan" element={<Summary/>}/>
          <Route path="laporan" element={<ReportList/>}/>
          <Route path="laporan/baru" element={<ReportForm/>}/>
          <Route path="laporan/:id/edit" element={<ReportForm/>}/>
          <Route path="laporan/:id" element={<ReportDetail/>}/>
          <Route path="*" element={<section className="boot-screen"><h1>Halaman tidak ditemukan</h1><Link to="/">Kembali ke dasbor</Link></section>}/>
        </Route>
      </Routes></div>
      {expired && <Login expired/>}
    </>}
  </AuthContext.Provider>
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>)
