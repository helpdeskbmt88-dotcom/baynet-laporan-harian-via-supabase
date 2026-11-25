import { useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Check, ChevronDown, Eye, EyeOff, FlaskConical, KeyRound, Layers3, LoaderCircle, Network, Sun, UserRound } from 'lucide-react'
import { useAuth } from './shared.jsx'
import RegistrationForm from './RegistrationForm.jsx'

const demoGroups = [
  ['Peninjau', [['supervisor','Supervisor'],['manajer','Manajer'],['supervisor-keuangan','Supervisor keuangan'],['manajer-keuangan','Manajer keuangan']]],
  ['Divisi operasional', [['noc','NOC'],['helpdesk','Helpdesk'],['customer-service','Customer Service'],['teknisi','Teknisi'],['gudang','Gudang'],['cleaning-service','Cleaning Service'],['finance','Finance'],['accounting','Accounting']]],
]

export default function Login({ expired = false }) {
  const { login, meta, user } = useAuth()
  const [username, setUsername] = useState(expired ? user.username : '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [demoAccount, setDemoAccount] = useState('supervisor')
  const [demoOpen, setDemoOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  const passwordInput = useRef(null)

  function openRegistration() {
    setError('')
    setNotice('')
    setPassword('')
    setShowPassword(false)
    setDemoOpen(false)
    setRegistering(true)
  }

  function accountCreated(newUsername, pending) {
    setUsername(newUsername)
    setNotice(pending ? 'Pengajuan terkirim. Anda dapat masuk setelah administrator menyetujui akun.' : 'Akun berhasil dibuat. Masukkan kata sandi Anda untuk masuk.')
    setRegistering(false)
  }

  function chooseDemoAccount() {
    setUsername(demoAccount)
    setPassword('')
    setShowPassword(false)
    setDemoOpen(false)
    setError('')
    setNotice('Masukkan kata sandi demo untuk akun ini.')
    passwordInput.current?.focus()
  }

  async function signIn() {
    if (pending.current) return
    pending.current = true
    setBusy('account')
    setError('')
    setNotice('')
    try {
      await login({ username: username.trim(), password })
    } catch (err) { setError(err.message) }
    finally { pending.current = false; setBusy('') }
  }
  return <main className={'login-page' + (expired ? ' session-overlay' : '') + (registering ? ' registration-page' : '')} aria-label={registering ? 'Buat akun BAYNET' : 'Masuk ke BAYNET'}>
    <section className="login-visual">
      <div className="visual-brand"><span className="brand-line" />OPERASIONAL BAYNET</div>
      <div className="visual-copy">
        <h1>Laporan <br/>Harian<span>.</span></h1>
        <p>Catat pekerjaan setiap shift dan teruskan poin penting kepada tim berikutnya.</p>
        <div className="visual-facts"><span><Layers3 size={16}/>10 divisi</span><i/><span><Sun size={17}/>2 shift kerja</span></div>
      </div>
    </section>
    <section className="login-content">
      <div className="login-inner">
        <img className="auth-logo" src="/baynet-logo.png" alt="BAYNET — PT. Bayu Multimedia Telekomunikasi" width="174" height="50"/>
        <h2>{registering ? 'Buat akun baru' : expired ? 'Masuk kembali' : 'Masuk ke ruang kerja'}</h2>
        <p className="login-intro">{registering ? 'Pilih divisi Anda untuk mendaftar.' : expired ? 'Sesi Anda berakhir. Masuk dengan akun yang sama untuk melanjutkan pekerjaan.' : 'Gunakan akun BAYNET Anda untuk mengakses laporan harian.'}</p>
        {registering ? <RegistrationForm divisions={meta.registrationDivisions} onCreated={accountCreated} onBack={() => setRegistering(false)}/> : <>
        {notice && <div className="auth-notice" role="status"><Check size={17}/>{notice}</div>}
        {error && <div className="app-error" role="alert"><AlertCircle size={17}/>{error}</div>}
        <form className="auth-form" onSubmit={event => { event.preventDefault(); signIn() }}>
          <label htmlFor="username">Nama pengguna</label>
          <div className="auth-input"><UserRound size={18}/><input name="username" id="username" type="text" placeholder="Masukkan nama pengguna" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} readOnly={expired} onChange={e => setUsername(e.target.value)} required maxLength={60}/></div>
          <label htmlFor="password">Kata sandi</label>
          <div className="auth-input"><KeyRound size={18}/><input ref={passwordInput} id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Masukkan kata sandi" autoComplete="current-password" autoFocus={!!notice} value={password} onChange={e=>setPassword(e.target.value)} required maxLength={200}/>
            <button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          <button className="enter-button" disabled={!!busy}>{busy === 'account' ? <LoaderCircle className="app-spin" size={17}/> : null}Masuk<ArrowRight size={17}/></button>
        </form>
        {!expired && <div className="auth-switch">Belum punya akun? <button type="button" onClick={openRegistration} disabled={!!busy}>Buat akun baru</button></div>}
        {meta?.demo && !expired && <div className="demo-area">
          <button type="button" className="demo-toggle" onClick={()=>setDemoOpen(value=>!value)} aria-expanded={demoOpen} aria-controls="demo-controls"><FlaskConical size={16}/>Coba akun demo<ChevronDown size={15} className={demoOpen ? 'chevron-up' : ''}/></button>
          {demoOpen && <div id="demo-controls" className="demo-controls"><label htmlFor="demo-account">Akun contoh</label><div><select id="demo-account" value={demoAccount} onChange={e=>setDemoAccount(e.target.value)}>{demoGroups.map(([label,accounts])=><optgroup key={label} label={label}>{accounts.map(([value,text])=><option key={value} value={value}>{text}</option>)}</optgroup>)}</select><button onClick={chooseDemoAccount} type="button" disabled={!!busy}><Check size={15}/>Pilih akun</button></div></div>}
        </div>}
        </>}
      </div>
      <footer className="login-footer"><Network size={14}/> PT. Bayu Multimedia Telekomunikasi</footer>
    </section>
  </main>
}
