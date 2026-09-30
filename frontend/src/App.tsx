import { useEffect, useState, useCallback } from 'react';
import { api, EmailRow, User } from './api';
import { Button, Input, Modal, Table } from './ui';


// =====================================================
// HELPERS
// =====================================================

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString() : '-';


const badge = (status: string) => {

  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        ✓ Sent
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        ✕ Failed
      </span>
    );
  }

  if (status === 'sending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        ● Sending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      ◷ Scheduled
    </span>
  );
};


// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  icon,
  title,
  value,
  description
}: {
  icon: string;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-stone-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-stone-400">
            {description}
          </p>

        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
          {icon}
        </div>

      </div>

    </div>
  );
}


// =====================================================
// COMPOSE EMAIL
// =====================================================

function Compose({
  onClose,
  onDone,
  onError
}: {
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {

  const [f, setF] = useState({
    recipient: '',
    subject: '',
    body: '',
    startTime: '',
    delaySeconds: 2,
    hourlyLimit: 200
  });

  const [emails, setEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);


  // ===================================================
  // READ CSV / TXT
  // ===================================================

  const upload = async (file?: File) => {

    if (!file) return;

    const text = await file.text();

    const found =
      text.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      ) ?? [];

    const uniqueEmails = [
      ...new Set(
        found.map(email =>
          email.toLowerCase().trim()
        )
      )
    ];

    setEmails(uniqueEmails);
    setFileName(file.name);

    if (uniqueEmails.length === 0) {
      onError(
        'No valid email addresses found in the file.'
      );
    }
  };


  // ===================================================
  // SCHEDULE
  // ===================================================

  const submit = async () => {

    const manualEmails =
      f.recipient
        .split(/[,;\s]+/)
        .map(email =>
          email.trim().toLowerCase()
        )
        .filter(email => email.length > 0);


    const allEmails = [
      ...new Set([
        ...manualEmails,
        ...emails
      ])
    ];


    if (allEmails.length === 0) {
      onError(
        'Please enter at least one recipient or upload a CSV/TXT file.'
      );
      return;
    }


    if (!f.subject.trim()) {
      onError('Please enter an email subject.');
      return;
    }


    if (!f.body.trim()) {
      onError('Please enter your message.');
      return;
    }


    setBusy(true);


    try {

      await api.schedule({

        subject: f.subject,

        body: f.body,

        emails: allEmails,

        startTime: f.startTime
          ? new Date(
              f.startTime
            ).toISOString()
          : '',

        delaySeconds: f.delaySeconds,

        hourlyLimit: f.hourlyLimit

      });


      onDone();
      onClose();

    } catch (e: any) {

      onError(
        e.message ||
        'Failed to schedule email.'
      );

    } finally {

      setBusy(false);

    }
  };


  return (

    <Modal
      title="Compose New Email"
      onClose={onClose}
    >

      <div className="space-y-5">


        {/* INFORMATION BOX */}

        <div className="rounded-xl bg-emerald-50 p-4">

          <div className="font-semibold text-emerald-800">
            ✨ Schedule an email campaign
          </div>

          <div className="mt-1 text-xs text-emerald-700">
            Send to individual recipients or upload
            a CSV/TXT recipient list.
          </div>

        </div>


        {/* RECIPIENT */}

        <label className="block text-sm">

          <span className="mb-2 block font-medium text-stone-700">
            Recipients
          </span>

          <input
            type="text"
            placeholder="receiver@gmail.com, another@gmail.com"
            className="
              w-full
              rounded-xl
              border
              border-stone-200
              px-3.5
              py-2.5
              shadow-sm
              outline-none
              focus:border-emerald-500
              focus:ring-4
              focus:ring-emerald-500/10
            "
            value={f.recipient}
            onChange={e =>
              setF({
                ...f,
                recipient: e.target.value
              })
            }
          />

          <p className="mt-1.5 text-xs text-stone-400">
            Separate multiple email addresses with commas.
          </p>

        </label>


        {/* FILE */}

        <label className="block text-sm">

          <span className="mb-2 block font-medium text-stone-700">
            Upload recipient list
          </span>

          <input
            type="file"
            accept=".csv,.txt"
            className="
              w-full
              cursor-pointer
              rounded-xl
              border
              border-dashed
              border-stone-300
              bg-stone-50
              px-3
              py-3
              text-sm
              text-stone-600
              hover:border-emerald-400
              hover:bg-emerald-50/30
            "
            onChange={e =>
              upload(
                e.target.files?.[0]
              )
            }
          />

          <p className="mt-1.5 text-xs text-stone-400">
            Supported formats: CSV and TXT.
          </p>

        </label>


        {/* FILE RESULT */}

        {fileName && (

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-semibold text-stone-800">
                  📄 {fileName}
                </p>

                <p className="mt-1 text-xs text-emerald-700">
                  {emails.length} valid email
                  {emails.length !== 1 ? 's' : ''}
                  {' '}detected
                </p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-emerald-700 shadow-sm">
                {emails.length}
              </div>

            </div>

          </div>

        )}


        {/* SUBJECT */}

        <Input
          label="Subject"
          type="text"
          placeholder="Enter email subject"
          value={f.subject}
          onChange={e =>
            setF({
              ...f,
              subject: e.target.value
            })
          }
        />


        {/* MESSAGE */}

        <label className="block text-sm">

          <span className="mb-2 block font-medium text-stone-700">
            Message
          </span>

          <textarea
            rows={6}
            placeholder="Write your message here..."
            className="
              w-full
              rounded-xl
              border
              border-stone-200
              px-3.5
              py-3
              text-sm
              shadow-sm
              outline-none
              focus:border-emerald-500
              focus:ring-4
              focus:ring-emerald-500/10
            "
            value={f.body}
            onChange={e =>
              setF({
                ...f,
                body: e.target.value
              })
            }
          />

        </label>


        {/* SEND TIME */}

        <Input
          label="Send Time"
          type="datetime-local"
          value={f.startTime}
          onChange={e =>
            setF({
              ...f,
              startTime: e.target.value
            })
          }
        />


        {/* DELAY + LIMIT */}

        <div className="grid grid-cols-2 gap-4">

          <Input
            label="Delay between emails (seconds)"
            type="number"
            min={0}
            value={f.delaySeconds}
            onChange={e =>
              setF({
                ...f,
                delaySeconds:
                  +e.target.value
              })
            }
          />

          <Input
            label="Hourly limit"
            type="number"
            min={1}
            value={f.hourlyLimit}
            onChange={e =>
              setF({
                ...f,
                hourlyLimit:
                  +e.target.value
              })
            }
          />

        </div>


        {/* BUTTONS */}

        <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-5">

          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            disabled={
              busy ||
              (
                !f.recipient.trim() &&
                emails.length === 0
              ) ||
              !f.subject.trim() ||
              !f.body.trim()
            }
            onClick={submit}
          >
            {busy
              ? 'Scheduling...'
              : 'Schedule Email →'}
          </Button>

        </div>

      </div>

    </Modal>
  );
}


// =====================================================
// MAIN APPLICATION
// =====================================================

export default function App() {

  const [user, setUser] =
    useState<User | null>(null);

  const [checked, setChecked] =
    useState(false);

  const [tab, setTab] =
    useState<'scheduled' | 'sent'>(
      'scheduled'
    );

  const [rows, setRows] =
    useState<EmailRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [compose, setCompose] =
    useState(false);

  const [err, setErr] =
    useState('');

  const [slack, setSlack] =
    useState(false);


  // ===================================================
  // LOGIN CHECK
  // ===================================================

  useEffect(() => {

    api
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() =>
        setChecked(true)
      );

  }, []);


  // ===================================================
  // LOAD EMAILS
  // ===================================================

  const load = useCallback(
    async (quiet = false) => {

      if (!quiet) {
        setLoading(true);
      }

      try {

        setRows(
          await api.emails(tab)
        );

      } catch (e: any) {

        setErr(e.message);

      } finally {

        setLoading(false);

      }

    },
    [tab]
  );


  useEffect(() => {

    if (!user) return;

    load();


    api
      .slack()
      .then(s =>
        setSlack(
          s.connected
        )
      )
      .catch(() => {});


    const timer =
      setInterval(
        () => load(true),
        5000
      );


    return () =>
      clearInterval(timer);

  }, [user, load]);


  // ===================================================
  // LOGIN SCREEN
  // ===================================================

  if (!checked) {
    return null;
  }


  if (!user) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-stone-100 p-6">

        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xl">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white shadow-lg shadow-emerald-600/20">
            ✉
          </div>

          <h1 className="mt-6 text-2xl font-bold text-stone-900">
            MailFlow
          </h1>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Smart email scheduling and automation
            for modern teams.
          </p>

          <a
            href="/auth/google"
            className="
              mt-7
              flex
              w-full
              items-center
              justify-center
              rounded-xl
              bg-stone-900
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              shadow-sm
              hover:bg-stone-800
            "
          >
            Continue with Google
          </a>

          <p className="mt-5 text-xs text-stone-400">
            Secure authentication powered by Google
          </p>

        </div>

      </div>

    );
  }


  // ===================================================
  // COUNTS
  // ===================================================

  const total = rows.length;

  const sent =
    rows.filter(
      r => r.status === 'sent'
    ).length;

  const scheduled =
    rows.filter(
      r =>
        r.status === 'scheduled' ||
        r.status === 'sending'
    ).length;

  const failed =
    rows.filter(
      r => r.status === 'failed'
    ).length;


  // ===================================================
  // DASHBOARD
  // ===================================================

  return (

    <div className="min-h-screen bg-stone-100">


      {/* =================================================
          HEADER
          ================================================= */}

      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">


          {/* LOGO */}

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white shadow-sm">
              ✉
            </div>

            <div>

              <h1 className="text-base font-bold text-stone-900">
                MailFlow
              </h1>

              <p className="text-[11px] text-stone-400">
                Email Automation Platform
              </p>

            </div>

          </div>


          {/* USER */}

          <div className="flex items-center gap-3">


            {slack ? (

              <button
                onClick={() =>
                  api
                    .slackDisconnect()
                    .then(() =>
                      setSlack(false)
                    )
                }
                className="hidden rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 sm:block"
              >
                Slack Connected
              </button>

            ) : (

              <a
                href="/auth/slack"
                className="hidden rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 sm:block"
              >
                Connect Slack
              </a>

            )}


            <div className="hidden items-center gap-2 md:flex">

              <img
                src={user.avatar}
                alt=""
                className="h-9 w-9 rounded-full border border-stone-200"
                referrerPolicy="no-referrer"
              />

              <div className="leading-tight">

                <div className="text-sm font-semibold text-stone-800">
                  {user.name}
                </div>

                <div className="text-[11px] text-stone-400">
                  {user.email}
                </div>

              </div>

            </div>


            <Button
              variant="ghost"
              onClick={() =>
                api
                  .logout()
                  .then(() =>
                    setUser(null)
                  )
              }
            >
              Logout
            </Button>

          </div>

        </div>

      </header>


      {/* =================================================
          MAIN
          ================================================= */}

      <main className="mx-auto max-w-7xl px-5 py-8">


        {/* WELCOME */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-sm font-medium text-emerald-600">
              Dashboard
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
              Good to see you, {user.name.split(' ')[0]} 👋
            </h2>

            <p className="mt-1 text-sm text-stone-500">
              Monitor and manage your email campaigns.
            </p>

          </div>


          <Button
            onClick={() =>
              setCompose(true)
            }
            className="shadow-md shadow-emerald-600/10"
          >
            + Compose Email
          </Button>

        </div>


        {/* =================================================
            STAT CARDS
            ================================================= */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            icon="✉"
            title="Total Emails"
            value={total}
            description="Email records"
          />

          <StatCard
            icon="✓"
            title="Sent"
            value={sent}
            description="Successfully sent"
          />

          <StatCard
            icon="◷"
            title="Scheduled"
            value={scheduled}
            description="Waiting to be sent"
          />

          <StatCard
            icon="!"
            title="Failed"
            value={failed}
            description="Requires attention"
          />

        </div>


        {/* =================================================
            EMAIL ACTIVITY
            ================================================= */}

        <section className="mt-7">

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">


            {/* SECTION HEADER */}

            <div className="flex flex-col gap-4 border-b border-stone-100 p-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h3 className="font-bold text-stone-900">
                  Email Activity
                </h3>

                <p className="mt-1 text-xs text-stone-400">
                  Track your scheduled and sent emails
                </p>

              </div>


              {/* TABS */}

              <div className="flex w-fit rounded-xl bg-stone-100 p-1">

                <button
                  onClick={() =>
                    setTab('scheduled')
                  }
                  className={`
                    rounded-lg
                    px-4
                    py-2
                    text-xs
                    font-semibold
                    transition
                    ${
                      tab === 'scheduled'
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }
                  `}
                >
                  Scheduled
                </button>


                <button
                  onClick={() =>
                    setTab('sent')
                  }
                  className={`
                    rounded-lg
                    px-4
                    py-2
                    text-xs
                    font-semibold
                    transition
                    ${
                      tab === 'sent'
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }
                  `}
                >
                  Sent
                </button>

              </div>

            </div>


            {/* TABLE */}

            <Table
              rows={rows}
              loading={loading}
              empty={
                tab === 'scheduled'
                  ? 'No scheduled emails'
                  : 'No emails sent yet'
              }
              cols={[

                {
                  head: 'Recipient',

                  cell: r => (

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm">
                        ✉
                      </div>

                      <span className="font-medium text-stone-800">
                        {r.recipient}
                      </span>

                    </div>

                  )
                },


                {
                  head: 'Subject',

                  cell: r => (

                    <span className="text-stone-700">
                      {r.subject}
                    </span>

                  )
                },


                tab === 'scheduled'
                  ? {
                      head: 'Scheduled',

                      cell: r => (
                        <span className="text-stone-500">
                          {fmt(r.scheduled_at)}
                        </span>
                      )
                    }
                  : {
                      head: 'Sent',

                      cell: r => (
                        <span className="text-stone-500">
                          {fmt(r.sent_at)}
                        </span>
                      )
                    },


                {
                  head: 'Status',

                  cell: r =>
                    badge(r.status)

                }

              ]}
            />

          </div>

        </section>


        {/* =================================================
            SYSTEM STATUS
            ================================================= */}

        <section className="mt-7">

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <h3 className="font-bold text-stone-900">
                  System Status
                </h3>

                <p className="mt-1 text-xs text-stone-400">
                  Current application services
                </p>

              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ● Operational
              </span>

            </div>


            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">


              {[
                ['API', 'Express'],
                ['Database', 'PostgreSQL'],
                ['Queue', 'Redis + BullMQ'],
                ['Email', 'Gmail SMTP']
              ].map(item => (

                <div
                  key={item[0]}
                  className="rounded-xl border border-stone-100 bg-stone-50 p-4"
                >

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs font-medium text-stone-400">
                        {item[0]}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-stone-800">
                        {item[1]}
                      </p>

                    </div>

                    <span className="text-emerald-600">
                      ✓
                    </span>

                  </div>

                </div>

              ))}

            </div>

          </div>

        </section>


        {/* =================================================
            ERROR
            ================================================= */}

        {err && (

          <div
            className="fixed bottom-5 right-5 z-40 max-w-sm cursor-pointer rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl"
            onClick={() =>
              setErr('')
            }
          >

            <div className="font-semibold">
              Something went wrong
            </div>

            <div className="mt-1 text-xs">
              {err}
            </div>

          </div>

        )}

      </main>


      {/* =================================================
          COMPOSE MODAL
          ================================================= */}

      {compose && (

        <Compose
          onClose={() =>
            setCompose(false)
          }
          onDone={() =>
            load()
          }
          onError={setErr}
        />

      )}

    </div>
  );
}