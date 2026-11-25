import { useRef, useState } from 'react'
import { AlertCircle, Building2, Eye, EyeOff, KeyRound, LoaderCircle, UserRound } from 'lucide-react'
import { api } from './shared.jsx'

export default function RegistrationForm({ divisions, onCreated, onBack }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const pending = useRef(false)

  async function register(event) {
    event.preventDefault()
    if (pending.current) return
    const form = event.currentTarget
    const { name, username, division, password, confirmation } = Object.fromEntries(new FormData(form))
    if (password !== confirmation) {
      form.elements.confirmation.setCustomValidity('Ulangi kata sandi yang sama.')
      form.elements.confirmation.reportValidity()
      return
    }
    setError('')
    pending.current = true
    setBusy(true)
    try {
      await api('/register', { method: 'POST', body: { name: name.trim(), username: username.trim(), division, password } })
      onCreated(username.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <>
    {error && <div className="app-error" role="alert"><AlertCircle size={17}/>{error}</div>}
    <form className="auth-form" onSubmit={register} onInput={event => event.currentTarget.elements.confirmation.setCustomValidity('')}>
      <label htmlFor="reg-name">Nama lengkap</label>
      <div className="auth-input"><UserRound size={18}/><input id="reg-name" name="name" autoComplete="name" autoFocus required maxLength={100}/></div>
      <label htmlFor="reg-division">Divisi</label>
      <div className="auth-input"><Building2 size={18}/><select id="reg-division" name="division" defaultValue="" required>
        <option value="" disabled>Pilih divisi Anda</option>
        {divisions.map(division => <option key={division}>{division}</option>)}
      </select></div>
      <label htmlFor="reg-username">Nama pengguna</label>
      <div className="auth-input"><UserRound size={18}/><input id="reg-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={2} maxLength={60} pattern="[A-Za-z0-9._\-]{2,60}" aria-describedby="reg-username-hint"/></div>
      <small className="auth-hint" id="reg-username-hint">Gunakan 2–60 huruf, angka, titik, garis bawah, atau tanda hubung.</small>
      <label htmlFor="reg-password">Kata sandi</label>
      <div className="auth-input"><KeyRound size={18}/><input id="reg-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} maxLength={200} aria-describedby="reg-password-hint"/>
        <button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
      </div>
      <small className="auth-hint" id="reg-password-hint">Gunakan minimal 10 karakter.</small>
      <label htmlFor="reg-confirmation">Konfirmasi kata sandi</label>
      <div className="auth-input"><KeyRound size={18}/><input id="reg-confirmation" name="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} maxLength={200}/></div>
      <button type="submit" className="enter-button" disabled={busy}>{busy && <LoaderCircle size={17} className="app-spin"/>}Buat akun</button>
    </form>
    <div className="auth-switch"><button type="button" disabled={busy} onClick={onBack}>Kembali ke halaman masuk</button></div>
  </>
}
