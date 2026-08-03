import { useEffect, useState } from 'react';
import { COLORS, SURFACES, BRAND } from '@priorbyte/shared/brand';
import { getConfig } from '~lib/config';
import { getSupabaseClient } from '~lib/supabase';
import { requestCode, verifyCode, signOut } from '~lib/auth';
import { captureLearningEvent } from '~lib/capture';

const styles = {
  root: {
    width: 320,
    padding: 16,
    background: COLORS.background,
    color: COLORS.silver,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  heading: {
    fontFamily: 'Sora, system-ui, sans-serif',
    fontWeight: 700,
    color: '#fff',
    fontSize: 16,
    margin: 0,
  },
  label: {
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: SURFACES.muted,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    background: SURFACES.surface,
    border: `1px solid ${SURFACES.line}`,
    borderRadius: 8,
    color: '#fff',
    padding: '8px 10px',
    marginTop: 6,
    marginBottom: 10,
    fontSize: 13,
  },
  button: {
    width: '100%',
    background: COLORS.cyan,
    color: COLORS.background,
    border: 'none',
    borderRadius: 8,
    padding: '10px 12px',
    fontWeight: 700,
    fontFamily: 'Sora, system-ui, sans-serif',
    cursor: 'pointer',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: SURFACES.muted,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    padding: 0,
    marginTop: 10,
  },
  error: { color: COLORS.amber, fontSize: 12, marginTop: 8 },
  success: { color: COLORS.teal, fontSize: 12, marginTop: 8 },
};

function SetupNotice() {
  return (
    <div style={styles.root}>
      <p style={styles.heading}>{BRAND.name}</p>
      <p style={{ ...styles.label, color: COLORS.amber, marginTop: 10 }}>Not configured</p>
      <p style={{ fontSize: 12, marginTop: 6 }}>
        Set PLASMO_PUBLIC_SUPABASE_URL and PLASMO_PUBLIC_SUPABASE_ANON_KEY in
        extension/.env.local, then rebuild.
      </p>
    </div>
  );
}

function SignInView({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setPending(true);
    setError(null);
    const { error } = await requestCode(email);
    setPending(false);
    if (error) setError(error);
    else setStage('code');
  }

  async function submitCode() {
    setPending(true);
    setError(null);
    const { error } = await verifyCode(email, code);
    setPending(false);
    if (error) setError(error);
    else onSignedIn();
  }

  return (
    <div style={styles.root}>
      <p style={styles.heading}>{BRAND.name}</p>
      <p style={{ ...styles.label, marginTop: 10 }}>Email</p>
      <input
        style={styles.input}
        type="email"
        value={email}
        disabled={stage === 'code'}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@university.edu"
      />

      {stage === 'email' ? (
        <button style={styles.button} disabled={pending || !email} onClick={sendCode}>
          {pending ? 'Sending…' : 'Send code'}
        </button>
      ) : (
        <>
          <p style={styles.label}>6-digit code</p>
          <input
            style={styles.input}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
          />
          <button style={styles.button} disabled={pending || code.length < 6} onClick={submitCode}>
            {pending ? 'Verifying…' : 'Verify'}
          </button>
          <button style={styles.linkButton} onClick={() => setStage('email')}>
            ← Use a different email
          </button>
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

function CaptureView({ email, onSignedOut }: { email: string; onSignedOut: () => void }) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function saveNote() {
    if (!note.trim()) return;
    setStatus('saving');
    setError(null);
    const result = await captureLearningEvent({
      type: 'note',
      content: note.trim(),
      occurredAt: new Date().toISOString(),
    });
    if (result.ok) {
      setStatus('saved');
      setNote('');
    } else {
      setStatus('error');
      setError(result.error ?? 'Could not save.');
    }
  }

  return (
    <div style={styles.root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={styles.heading}>{BRAND.name}</p>
        <button style={styles.linkButton} onClick={() => void signOut().then(onSignedOut)}>
          Sign out
        </button>
      </div>
      <p style={{ ...styles.label, marginTop: 4 }}>{email}</p>

      <p style={{ fontSize: 12, marginTop: 12, color: COLORS.teal }}>
        ● Capturing selections passively as you browse
      </p>

      <p style={{ ...styles.label, marginTop: 14 }}>Capture a note manually</p>
      <textarea
        style={{ ...styles.input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What are you stuck on right now?"
      />
      <button style={styles.button} disabled={status === 'saving' || !note.trim()} onClick={saveNote}>
        {status === 'saving' ? 'Saving…' : 'Save to Priorbyte'}
      </button>

      {status === 'saved' && <p style={styles.success}>Saved.</p>}
      {status === 'error' && <p style={styles.error}>{error}</p>}
    </div>
  );
}

export default function Popup() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const configured = getConfig() !== null;

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const supabase = getSupabaseClient();
    supabase?.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
  }, [configured]);

  if (!configured) return <SetupNotice />;
  if (!ready) return <div style={styles.root} />;

  return email ? (
    <CaptureView email={email} onSignedOut={() => setEmail(null)} />
  ) : (
    <SignInView onSignedIn={() => void getSupabaseClient()?.auth.getUser().then((r) => setEmail(r.data.user?.email ?? null))} />
  );
}
