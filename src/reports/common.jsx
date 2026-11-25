import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCheck, Clock3, FileCheck2, FilePenLine, RotateCcw, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../shared.jsx';

export const divisions = ['Manajer', 'Supervisor', 'NOC', 'Helpdesk', 'Customer Service', 'Teknisi', 'Gudang', 'Cleaning Service', 'Finance', 'Accounting'];
export const evidenceDivisions = ['Gudang', 'Customer Service', 'Helpdesk', 'NOC', 'Cleaning Service'];
export const statuses = {
  draft: { label: 'Draf', Icon: FilePenLine },
  submitted: { label: 'Menunggu Supervisor', Icon: Clock3 },
  supervisor_approved: { label: 'Menunggu Manajer', Icon: FileCheck2 },
  approved: { label: 'Disetujui', Icon: CheckCheck },
  revision: { label: 'Perlu revisi', Icon: RotateCcw },
};
export const details = {
  Manajer: ['Keputusan manajemen', 'prioritas pekerjaan tim'],
  Supervisor: ['Tim atau area', 'tim operasional lapangan'],
  NOC: ['Gangguan dan durasi', 'link utama, 12 menit'],
  Helpdesk: ['Nomor tiket', 'HD-1024'],
  'Customer Service': ['Referensi layanan', 'permintaan aktivasi CS-021'],
  Teknisi: ['Lokasi dan hasil kunjungan', 'Cijaya, pemasangan selesai'],
  Gudang: ['Mutasi stok', '4 unit ONT keluar'],
  'Cleaning Service': ['Area kerja', 'ruang NOC dan lobi'],
  Finance: ['Referensi transaksi', 'bukti kas keluar 014'],
  Accounting: ['Referensi jurnal', 'jurnal rekonsiliasi 022'],
};

export function wibDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (key) => parts.find(p => p.type === key).value;
  return [part('year'), part('month'), part('day')].join('-');
}
export function prettyDate(value, long = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(value + 'T12:00:00+07:00'));
}
export function timestamp(value) {
  if (!value) return '—';
  const at = new Date(value);
  if (isNaN(at.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(at) + ' WIB';
}
export function fileSize(size) {
  return size >= 1048576 ? (size / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.ceil(size / 1024)) + ' KB';
}
export function errorMessage(err) {
  return err.message || 'Terjadi kesalahan. Coba lagi.';
}
export function useRemote(path, key = 0) {
  const [token, setToken] = useState(0);
  const request = JSON.stringify([path, key, token]);
  const [state, setState] = useState({ request: null, data: null, error: '' });
  const refresh = useCallback(() => setToken(v => v + 1), []);
  useEffect(() => {
    let active = true;
    if (path) {
      api(path).then(data => {
        if (active) setState({ request, data, error: '' });
      }).catch(err => {
        if (active) setState({ request, data: null, error: errorMessage(err) });
      });
    }
    return () => { active = false; };
  }, [path, request]);
  return state.request === request ? { ...state, loading: false, refresh } : { data: null, error: '', loading: Boolean(path), refresh };
}
export function statusLabel(value, division) {
  return value === 'submitted' && division === 'Supervisor' ? 'Menunggu Manajer' : statuses[value]?.label || value;
}
export function Status({ value, division }) {
  const { Icon } = statuses[value] || statuses.draft;
  return <span className={'br-status br-status-' + value}><Icon size={13} strokeWidth={2} />{statusLabel(value, division)}</span>;
}
export function Notice({ children, retry }) {
  return <div className="br-notice" role="alert"><AlertCircle size={17}/><div>{children}</div>{retry && <button type="button" onClick={retry}>Coba lagi</button>}</div>;
}
export function Loading() {
  return <div className="br-loading" role="status"><LoaderCircle className="br-spin" size={20}/> Memuat laporan…</div>;
}
export function Back({ to = '/laporan', children = 'Daftar laporan' }) {
  return <Link to={to} className="br-back"><ArrowLeft size={15}/>{children}</Link>;
}
