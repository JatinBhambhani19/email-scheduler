export interface User { id: string; email: string; name: string; avatar: string }
export interface EmailRow { id: number; recipient: string; subject: string; scheduled_at: string; sent_at: string | null; status: string }
export interface ScheduleInput { subject: string; body: string; emails: string[]; startTime: string; delaySeconds: number; hourlyLimit: number }

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Request failed (${r.status})`);
  return r.json();
}
export const api = {
  me: () => req<User>('/api/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  emails: (status: 'scheduled' | 'sent') => req<EmailRow[]>(`/api/emails?status=${status}`),
  schedule: (b: ScheduleInput) => req('/api/schedule', { method: 'POST', body: JSON.stringify(b) }),
  slack: () => req<{ connected: boolean }>('/api/slack'),
  slackDisconnect: () => req('/api/slack', { method: 'DELETE' }),
};
