import { useEffect, useState } from 'react'
import { api } from './shared.jsx'

const token = location.pathname === '/persetujuan' ? location.hash.slice(1) : ''
if (token) history.replaceState(null, '', location.pathname)

export default function RegistrationReview() {
  const [request,setRequest] = useState(null)
  const [scope,setScope] = useState([])
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('Memuat pengajuan…')
  useEffect(() => {
    api('/registration-review',{method:'POST',body:{token,action:'inspect'}})
      .then(data => { setRequest(data); setMessage('') })
      .catch(err => setMessage(err.message))
  },[])
  async function decide(action) {
    setBusy(true)
    try {
      await api('/registration-review',{method:'POST',body:{token,action,reviewDivisions:scope}})
      setRequest(null)
      setMessage(action === 'approve' ? 'Pengajuan disetujui. Akun sudah aktif.' : 'Pengajuan ditolak.')
    } catch (err) { setMessage(err.message) }
    finally { setBusy(false) }
  }
  return <main className="boot-screen"><img src="/baynet-logo.png" alt="BAYNET"/><h1>Persetujuan akun</h1>
    {message && <p role="status">{message}</p>}
    {request && <section><h2>{request.user.username}</h2><p>Pengajuan divisi {request.user.division}</p>
      {request.user.division !== 'Direktur' && <fieldset><legend>Pilih divisi yang boleh ditinjau akun ini</legend>
        {request.divisions.map(d => <label key={d} style={{display:'block'}}><input type="checkbox" checked={scope.includes(d)} onChange={e => setScope(e.target.checked ? [...scope,d] : scope.filter(v => v !== d))}/> {d}</label>)}
      </fieldset>}
      <button className="boot-retry" disabled={busy || (request.user.division !== 'Direktur' && !scope.length)} onClick={() => decide('approve')}>Setujui</button>
      <button className="boot-retry" disabled={busy} onClick={() => decide('reject')}>Tolak</button>
    </section>}
  </main>
}
