import pg from 'pg';
import { cfg } from './config';

export const db = new pg.Pool({
  connectionString: cfg.pg
});

export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS slack_connections(
      user_id TEXT PRIMARY KEY,
      webhook_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS senders(
      id SERIAL PRIMARY KEY,
      user_name TEXT,
      pass TEXT
    );

    CREATE TABLE IF NOT EXISTS emails(
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      sender_id INT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      status TEXT DEFAULT 'scheduled',
      hourly_limit INT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS emails_user_status
    ON emails(user_id, status);

    CREATE INDEX IF NOT EXISTS emails_scheduled_at
    ON emails(scheduled_at);

    CREATE INDEX IF NOT EXISTS emails_recipient
    ON emails(recipient);
  `);

  const { rows } = await db.query(
    'SELECT count(*)::int AS c FROM senders'
  );

  if (rows[0].c === 0) {
    await db.query(
      'INSERT INTO senders(user_name, pass) VALUES($1,$2)',
      [
        process.env.SMTP_USER || 'gmail-smtp',
        'smtp'
      ]
    );
  }
}