import express, {
  Request,
  Response,
  NextFunction
} from 'express';

import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { cfg } from './config';
import { db, initDb } from './db';
import { emailQueue } from './queue';
import { indexEmail, searchEmails } from './es';

import './worker';

const app = express();

app.use(
  express.json({
    limit: '5mb'
  })
);

app.use(cookieParser());


// =====================================================
// HELPERS
// =====================================================

const form = (o: Record<string, string>) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams(o)
});


const auth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        error: 'Not logged in'
      });
    }

    (req as any).user = jwt.verify(
      token,
      cfg.jwt
    );

    next();

  } catch {
    return res.status(401).json({
      error: 'Not logged in'
    });
  }
};


const uid = (req: Request) =>
  (req as any).user.id as string;


// =====================================================
// BULL BOARD
// =====================================================

const board = new ExpressAdapter();

board.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue) as any
  ],
  serverAdapter: board
});

app.use(
  '/admin/queues',
  board.getRouter()
);


// =====================================================
// GOOGLE OAUTH
// =====================================================

const gRedirect =
  `http://localhost:${cfg.port}/auth/google/callback`;


app.get('/auth/google', (_req, res) => {

  const params = new URLSearchParams({
    client_id: cfg.gid,
    redirect_uri: gRedirect,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account'
  });

  res.redirect(
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    params.toString()
  );
});


app.get(
  '/auth/google/callback',
  async (req, res) => {

    try {

      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        form({
          code: String(req.query.code),
          client_id: cfg.gid,
          client_secret: cfg.gsec,
          redirect_uri: gRedirect,
          grant_type: 'authorization_code'
        })
      );

      const t: any =
        await tokenResponse.json();

      if (!t.access_token) {
        console.error(
          'Google token error:',
          t
        );

        return res
          .status(400)
          .send('Google authentication failed.');
      }


      const userInfoResponse =
        await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization:
                `Bearer ${t.access_token}`
            }
          }
        );

      const g: any =
        await userInfoResponse.json();


      const user = {
        id: g.sub,
        email: g.email,
        name: g.name,
        avatar: g.picture
      };


      await db.query(
        `INSERT INTO users
          (id, email, name, avatar)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(id)
         DO UPDATE SET
           email=$2,
           name=$3,
           avatar=$4`,
        Object.values(user)
      );


      const token = jwt.sign(
        user,
        cfg.jwt,
        {
          expiresIn: '7d'
        }
      );


      res
        .cookie(
          'token',
          token,
          {
            httpOnly: true,
            sameSite: 'lax'
          }
        )
        .redirect(cfg.base);

    } catch (error: any) {

      console.error(
        'Google OAuth error:',
        error.message
      );

      res
        .status(500)
        .send('Google authentication failed.');
    }
  }
);


app.post(
  '/auth/logout',
  (_req, res) => {

    res
      .clearCookie('token')
      .json({
        ok: true
      });
  }
);


app.get(
  '/api/me',
  auth,
  (req, res) => {

    res.json(
      (req as any).user
    );
  }
);


// =====================================================
// SLACK OAUTH
// =====================================================

const sRedirect =
  `${cfg.base}/auth/slack/callback`;


app.get(
  '/auth/slack',
  auth,
  (_req, res) => {

    const params = new URLSearchParams({
      client_id: cfg.sid,
      scope: 'incoming-webhook',
      redirect_uri: sRedirect
    });

    res.redirect(
      'https://slack.com/oauth/v2/authorize?' +
      params.toString()
    );
  }
);


app.get(
  '/auth/slack/callback',
  auth,
  async (req, res) => {

    try {

      const response =
        await fetch(
          'https://slack.com/api/oauth.v2.access',
          form({
            code: String(req.query.code),
            client_id: cfg.sid,
            client_secret: cfg.ssec,
            redirect_uri: sRedirect
          })
        );


      const j: any =
        await response.json();


      if (j.ok && j.incoming_webhook?.url) {

        await db.query(
          `INSERT INTO slack_connections
             (user_id, webhook_url)
           VALUES($1,$2)
           ON CONFLICT(user_id)
           DO UPDATE SET
             webhook_url=$2`,
          [
            uid(req),
            j.incoming_webhook.url
          ]
        );
      }


      res.redirect(cfg.base);

    } catch (error: any) {

      console.error(
        'Slack OAuth error:',
        error.message
      );

      res
        .status(500)
        .send('Slack connection failed.');
    }
  }
);


app.get(
  '/api/slack',
  auth,
  async (req, res) => {

    const result =
      await db.query(
        `SELECT 1
         FROM slack_connections
         WHERE user_id=$1`,
        [uid(req)]
      );


    res.json({
      connected:
        (result.rowCount ?? 0) > 0
    });
  }
);


app.delete(
  '/api/slack',
  auth,
  async (req, res) => {

    await db.query(
      `DELETE FROM slack_connections
       WHERE user_id=$1`,
      [uid(req)]
    );


    res.json({
      ok: true
    });
  }
);


// =====================================================
// EMAIL SCHEDULING
// =====================================================

app.post(
  '/api/schedule',
  auth,
  async (req, res) => {

    try {

      const {
        subject,
        body,
        emails,
        startTime,
        delaySeconds = 0,
        hourlyLimit
      } = req.body;


      // -----------------------------------------------
      // BASIC VALIDATION
      // -----------------------------------------------

      if (!subject || !body) {

        return res.status(400).json({
          error:
            'Subject and body are required.'
        });
      }


      if (
        !Array.isArray(emails) ||
        emails.length === 0
      ) {

        return res.status(400).json({
          error:
            'At least one recipient email is required.'
        });
      }


      // -----------------------------------------------
      // CLEAN EMAIL ADDRESSES
      // -----------------------------------------------

      const cleanEmails = [
        ...new Set(
          emails
            .map(
              (email: unknown) =>
                String(email)
                  .trim()
                  .toLowerCase()
            )
            .filter(
              (email: string) =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                  .test(email)
            )
        )
      ];


      if (cleanEmails.length === 0) {

        return res.status(400).json({
          error:
            'No valid email addresses found.'
        });
      }


      // -----------------------------------------------
      // GET SENDERS
      // -----------------------------------------------

      const {
        rows: senders
      } = await db.query(
        'SELECT id FROM senders ORDER BY id'
      );


      if (senders.length === 0) {

        return res.status(500).json({
          error:
            'No sender is configured in the database.'
        });
      }


      // -----------------------------------------------
      // START TIME
      // -----------------------------------------------

      let start = Date.now();


      if (startTime) {

        const parsed =
          new Date(startTime).getTime();


        if (Number.isNaN(parsed)) {

          return res.status(400).json({
            error:
              'Invalid send time.'
          });
        }


        start = parsed;
      }


      // -----------------------------------------------
      // DELAY
      // -----------------------------------------------

      const delay =
        Math.max(
          Number(delaySeconds) || 0,
          0
        );


      // -----------------------------------------------
      // HOURLY LIMIT
      // -----------------------------------------------

      const limit =
        hourlyLimit
          ? Math.max(
              Number(hourlyLimit),
              1
            )
          : null;


      // -----------------------------------------------
      // CREATE ONE DB ROW + ONE JOB
      // FOR EVERY RECIPIENT
      // -----------------------------------------------

      const scheduledEmails = [];


      for (
        let i = 0;
        i < cleanEmails.length;
        i++
      ) {

        const recipient =
          cleanEmails[i];


        const scheduledTime =
          Math.max(
            start +
              i * delay * 1000,
            Date.now()
          );


        // -------------------------------------------
        // INSERT EMAIL INTO DATABASE
        // -------------------------------------------

        const {
          rows: [row]
        } = await db.query(
          `INSERT INTO emails(
             user_id,
             sender_id,
             recipient,
             subject,
             body,
             scheduled_at,
             hourly_limit
           )
           VALUES(
             $1,$2,$3,$4,$5,$6,$7
           )
           RETURNING *`,
          [
            uid(req),
            senders[
              i % senders.length
            ].id,
            recipient,
            subject.trim(),
            body.trim(),
            new Date(scheduledTime),
            limit
          ]
        );


        // -------------------------------------------
        // ADD JOB TO BULLMQ
        // -------------------------------------------

        const jobDelay =
          Math.max(
            scheduledTime -
              Date.now(),
            0
          );


        await emailQueue.add(
          'send',
          {
            id: row.id
          },
          {
            jobId:
              `email-${row.id}`,
            delay: jobDelay
          }
        );


        // -------------------------------------------
        // INDEX IN ELASTICSEARCH
        // -------------------------------------------

        await indexEmail(row);


        // -------------------------------------------
        // RESPONSE DATA
        // -------------------------------------------

        scheduledEmails.push({
          id: row.id,
          recipient: row.recipient,
          scheduledAt:
            row.scheduled_at
        });


        console.log(
          `📋 Scheduled email #${row.id} → ${recipient}`
        );
      }


      console.log(
        `✅ Scheduled ${scheduledEmails.length} emails`
      );


      console.table(
        scheduledEmails
      );


      return res.json({
        scheduled:
          scheduledEmails.length,
        emails:
          scheduledEmails
      });

    } catch (error: any) {

      console.error(
        '❌ Schedule error:',
        error.message
      );


      return res.status(500).json({
        error:
          'Failed to schedule emails.'
      });
    }
  }
);


// =====================================================
// GET EMAILS
// =====================================================

app.get(
  '/api/emails',
  auth,
  async (req, res) => {

    try {

      const sent =
        req.query.status === 'sent';


      const statusCondition =
        sent
          ? `status IN ('sent','failed')`
          : `status IN ('scheduled','sending')`;


      const order =
        sent
          ? 'sent_at DESC'
          : 'scheduled_at ASC';


      const {
        rows
      } = await db.query(
        `SELECT
           id,
           recipient,
           subject,
           scheduled_at,
           sent_at,
           status
         FROM emails
         WHERE user_id=$1
         AND ${statusCondition}
         ORDER BY ${order}
         LIMIT 500`,
        [uid(req)]
      );


      res.json(rows);

    } catch (error: any) {

      console.error(
        '❌ Email list error:',
        error.message
      );


      res.status(500).json({
        error:
          'Failed to load emails.'
      });
    }
  }
);


// =====================================================
// ELASTICSEARCH SEARCH
// =====================================================

app.get(
  '/api/search',
  auth,
  async (req, res) => {

    try {

      const result =
        await searchEmails(
          uid(req),
          String(
            req.query.q ?? ''
          )
        );


      res.json(result);

    } catch (error: any) {

      console.error(
        '❌ Search error:',
        error.message
      );


      res.status(500).json({
        error:
          'Search failed.'
      });
    }
  }
);


// =====================================================
// START SERVER
// =====================================================

initDb()
  .then(() => {

    app.listen(
      cfg.port,
      () => {

        console.log(
          `🚀 API running on port ${cfg.port}`
        );

        console.log(
          `📊 Bull Board: http://localhost:${cfg.port}/admin/queues`
        );
      }
    );

  })
  .catch((error) => {

    console.error(
      '❌ Database initialization failed:',
      error
    );

    process.exit(1);
  });