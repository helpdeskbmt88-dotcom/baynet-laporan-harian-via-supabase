const usePostgres = Boolean(process.env.SUPABASE_DB_URL);
if (process.env.VERCEL && !usePostgres) {
  throw new Error('Isi SUPABASE_DB_URL pada proyek Vercel untuk menghubungkan database BAYNET.');
}
const adapter = usePostgres ? await import('./postgres.js') : await import('./sqlite.js');
export const { db, transaction } = adapter;
