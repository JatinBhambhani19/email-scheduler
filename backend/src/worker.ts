import { Worker, DelayedError } from 'bullmq';
import nodemailer from 'nodemailer';
import { cfg } from './config';
import { db } from './db';
import { redis } from './queue';
import { indexEmail } from './es';

async function notifySlack(userId: string, text: string) {
  const { rows } = await db.query(
    'SELECT webhook_url FROM slack_connections WHERE user_id=$1',
    [userId]
  );

  if (!rows[0]) return;

  await fetch(rows[0].webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  }).catch(e => console.error('Slack failed:', e.message));
}


/*
 * Gmail SMTP transporter
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },

  tls: {
    rejectUnauthorized: true
  }
});


/*
 * Check SMTP connection when worker starts
 */
transporter.verify()
  .then(() => {
    console.log('✅ Gmail SMTP connection successful');
  })
  .catch((error) => {
    console.error('❌ Gmail SMTP connection failed');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Response:', error.response);
  });


export const worker = new Worker(
  'emails',

  async (job, token) => {

    /*
     * Get email information from database
     */
    const {
      rows: [e]
    } = await db.query(
      `SELECT e.*, s.user_name, s.pass
       FROM emails e
       JOIN senders s ON s.id = e.sender_id
       WHERE e.id = $1`,
      [job.data.id]
    );


    /*
     * Do nothing if email doesn't exist
     * or was already processed
     */
    if (!e || e.status !== 'scheduled') {
      return;
    }


    /*
     * Hourly sending limit
     */
    const hour = Math.floor(Date.now() / 3600000);

    const key = `rl:${e.sender_id}:${hour}`;

    const limit = e.hourly_limit || cfg.maxPerHour;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 7200);
    }


    /*
     * If hourly limit is reached
     */
    if (count > limit) {

      await redis.decr(key);

      const next =
        (hour + 1) * 3600000 +
        (e.id % 1000);

      await db.query(
        'UPDATE emails SET scheduled_at=$1 WHERE id=$2',
        [new Date(next), e.id]
      );

      await job.moveToDelayed(next, token);

      if (
        await redis.set(
          `rl-notified:${e.sender_id}:${hour}`,
          '1',
          'EX',
          7200,
          'NX'
        )
      ) {
        await notifySlack(
          e.user_id,
          `:warning: Sender #${e.sender_id} hit its hourly limit (${limit}). Remaining emails moved to the next hour.`
        );
      }

      throw new DelayedError();
    }


    /*
     * Claim the email
     * This prevents duplicate sending
     */
    const claim = await db.query(
      `UPDATE emails
       SET status='sending'
       WHERE id=$1
       AND status='scheduled'
       RETURNING id`,
      [e.id]
    );


    if (!claim.rowCount) {
      await redis.decr(key);
      return;
    }


    let status = 'sent';
    let error: string | null = null;


    /*
     * SEND EMAIL
     */
    try {

      console.log('-----------------------------------');
      console.log('📧 Sending email');
      console.log('To:', e.recipient);
      console.log('Subject:', e.subject);
      console.log('From:', process.env.SMTP_FROM);


      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: e.recipient,
        subject: e.subject,
        text: e.body
      });


      console.log('✅ Email sent successfully');
      console.log('To:', e.recipient);
      console.log('-----------------------------------');

    } catch (err: any) {

      status = 'failed';

      error = err?.message || 'Unknown SMTP error';

      console.error('===================================');
      console.error('❌ EMAIL SENDING FAILED');
      console.error('Message:', err?.message);
      console.error('Code:', err?.code);
      console.error('Command:', err?.command);
      console.error('Response:', err?.response);
      console.error('===================================');
    }


    /*
     * Update email status
     */
    const {
      rows: [u]
    } = await db.query(
      `UPDATE emails
       SET status=$1,
           error=$2,
           sent_at=now()
       WHERE id=$3
       RETURNING *`,
      [
        status,
        error,
        e.id
      ]
    );


    /*
     * Store email in Elasticsearch
     */
    await indexEmail(u);
  },

  {
    connection: redis,

    concurrency: cfg.concurrency,

    limiter: {
      max: 1,
      duration: cfg.minDelayMs
    }
  }
);


/*
 * BullMQ failed job handler
 */
worker.on('failed', (job, err) => {

  console.error(
    '❌ BullMQ job failed:',
    job?.id,
    err.message
  );

});


/*
 * Start worker
 */
if (require.main === module) {

  import('./db')
    .then(m => m.initDb())
    .then(() => {
      console.log('✅ Worker is running');
    });

}