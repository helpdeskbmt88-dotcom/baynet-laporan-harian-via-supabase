import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export async function api(path, options = {}) {
  const { body, headers, ...rest } = options
  let response
  try {
    response = await fetch('/api' + path, {
      ...rest,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('Koneksi ke server terputus. Periksa apakah aplikasi lokal masih berjalan, lalu coba lagi.')
  }
  let data
  try { data = await response.json() } catch {
    throw new Error('Server belum dapat memberikan respons. Periksa layanan BAYNET lalu coba lagi.')
  }
  if (!response.ok) {
    if (response.status === 401 && path !== '/login' && path !== '/me') {
      window.dispatchEvent(new Event('baynet:expired'))
    }
    throw Object.assign(new Error(data.error || 'Permintaan gagal diproses.'), { status: response.status, fields: data.fields })
  }
  return data
}
