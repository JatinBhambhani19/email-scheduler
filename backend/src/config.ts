import 'dotenv/config';

const n = (k: string, d: number) =>
  Number(process.env[k] ?? d);

const s = (k: string, d = '') =>
  process.env[k] ?? d;

export const cfg = {
  port: n('PORT', 4000),

  // Frontend URL
  base: s('BASE_URL', 'http://localhost:5173'),

  // Backend public URL
  backendBase: s('BACKEND_URL', 'http://localhost:4000'),

  redis: s(
    'REDIS_URL',
    'redis://localhost:6379'
  ),

  pg: s(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/scheduler'
  ),

  es: s(
    'ES_URL',
    'http://localhost:9200'
  ),

  jwt: s(
    'JWT_SECRET',
    'dev-secret'
  ),

  gid: s('GOOGLE_CLIENT_ID'),
  gsec: s('GOOGLE_CLIENT_SECRET'),

  sid: s('SLACK_CLIENT_ID'),
  ssec: s('SLACK_CLIENT_SECRET'),

  concurrency: n(
    'WORKER_CONCURRENCY',
    5
  ),

  minDelayMs: n(
    'MIN_DELAY_MS',
    2000
  ),

  maxPerHour: n(
    'MAX_EMAILS_PER_HOUR_PER_SENDER',
    200
  ),

  senders: n(
    'SENDER_COUNT',
    3
  ),
};