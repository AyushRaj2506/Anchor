import { useState } from 'react';
import { auth, updatePassword } from '../services/auth';
import './Login.css';

export default function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (!auth?.currentUser) return setError('This reset link is invalid or expired. Request a new link from the login page.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return setError('Use at least 8 characters, one uppercase letter and one number.');
    }
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try { await updatePassword(password); setSaved(true); }
    catch { setError('Could not update your password. Request a fresh reset link and try again.'); }
    finally { setSaving(false); }
  }
  return <main className="auth-container" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
    <section style={{ width: '100%', maxWidth: 440 }}>
      <h1>Set a new password</h1>
      {saved ? <><p role="status">Your password has been updated.</p><button className="auth-submit-btn" onClick={onComplete}>Continue to Anchor</button></>
        : <form onSubmit={submit}>
          <label className="auth-label" htmlFor="new-password">New password</label>
          <input className="auth-input" id="new-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required />
          <label className="auth-label" htmlFor="confirm-password">Confirm password</label>
          <input className="auth-input" id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required />
          {error && <p role="alert">{error}</p>}
          <button className="auth-submit-btn" disabled={saving}>{saving ? 'Saving...' : 'Update password'}</button>
          <button type="button" className="auth-switch-btn" onClick={onComplete}>Back to Anchor</button>
        </form>}
    </section>
  </main>;
}
