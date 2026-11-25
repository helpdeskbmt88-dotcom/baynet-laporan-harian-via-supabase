import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const databasePath = process.env.BAYNET_DB || path.join(root, 'data', 'baynet.sqlite');
export const port = Number(process.env.PORT || 3001);
export const host = process.env.HOST || '127.0.0.1';
export const divisions = ['Direktur', 'Manajer', 'Supervisor', 'NOC', 'Helpdesk', 'Customer Service', 'Teknisi', 'Gudang', 'Cleaning Service', 'Finance', 'Accounting'];
export const operational = divisions.slice(3);
export const financial = ['Finance', 'Accounting'];
export const regularDivisions = ['Manajer', 'Supervisor', ...financial];
export const attachmentDivisions = ['Gudang', 'Customer Service', 'Helpdesk', 'NOC', 'Cleaning Service'];
export const shifts = ['Pagi', 'Siang'];
export const statuses = ['draft', 'submitted', 'supervisor_approved', 'approved', 'revision'];
export const todayWIB = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
