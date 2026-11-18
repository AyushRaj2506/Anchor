import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import './Login.css';

/**
 * Login Component - Anchor College Second Brain Sign In Screen.
 */
function Login({ onSwitchView, theme, onToggleTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  function validateForm() {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';

    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (validateForm()) {
      setLoading(true);
      try {
        if (!auth) throw new Error('Authentication is not configured.');
        await signInWithEmailAndPassword(auth, email.trim(), password);
        // Navigation will be handled automatically by onAuthStateChanged in App.jsx
      } catch (err) {
        let authErr = 'Invalid email or password.';
        if (err.code === 'auth/network-request-failed') {
          authErr = 'Unable to connect to the authentication service. Please try again.';
        }
        if (!auth) authErr = 'Sign-in is not configured. You can explore the demo account.';
        setErrors({ auth: authErr });
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (loading) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors({ email: 'Enter your email address above to reset your password.' });
      return;
    }
    setLoading(true);
    setErrors({});
    setResetMessage('');
    try {
      if (!auth) throw new Error('Authentication is not configured.');
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage('If an account exists for this email, a password reset link has been sent.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') setResetMessage('If an account exists for this email, a password reset link has been sent.');
      else setErrors({ auth: 'Could not send a reset link. Please try again later.' });
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-container">
      {/* Theme toggle for auth pages */}
      <div className="auth-theme-toggle">
        <button
          className="auth-theme-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Left side: Branding & Feature Highlights */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand">
            <span className="auth-brand-logo" aria-hidden="true">⚓</span>
            <div className="auth-brand-text">
              <span className="auth-brand-name">Anchor</span>
              <span className="auth-brand-tagline">College Second Brain</span>
            </div>
          </div>

          <h2 className="auth-hero-title">
            Organize your<br />knowledge.<br />
            <span className="auth-hero-title-accent">Achieve more.</span>
          </h2>
          <p className="auth-hero-desc">
            Anchor helps you store, understand, and act on everything important in your college life.
          </p>

          <ul className="auth-features" role="list">
            <li className="auth-feature-item">
              <div className="auth-feature-icon" aria-hidden="true">📄</div>
              <div>
                <strong className="auth-feature-title">Save & organize</strong>
                <span className="auth-feature-desc">Store PDFs, notes, links, images and more.</span>
              </div>
            </li>
            <li className="auth-feature-item">
              <div className="auth-feature-icon" aria-hidden="true">🧠</div>
              <div>
                <strong className="auth-feature-title">AI understands</strong>
                <span className="auth-feature-desc">Get summaries, tags, deadlines and action items.</span>
              </div>
            </li>
            <li className="auth-feature-item">
              <div className="auth-feature-icon" aria-hidden="true">✅</div>
              <div>
                <strong className="auth-feature-title">Take action</strong>
                <span className="auth-feature-desc">Create tasks, set priorities and never miss a deadline.</span>
              </div>
            </li>
            <li className="auth-feature-item">
              <div className="auth-feature-icon" aria-hidden="true">🛡</div>
              <div>
                <strong className="auth-feature-title">Private & secure</strong>
                <span className="auth-feature-desc">Your data is private and accessible only to you.</span>
              </div>
            </li>
          </ul>
        </div>
        
        {/* Subtle footer graphics illustration */}
        <div className="auth-left-decor">
          <div className="decor-cup" aria-hidden="true">☕</div>
          <div className="decor-books" aria-hidden="true">📚</div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="auth-right">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Welcome back 🌿</h1>
            <p className="auth-form-subtitle">Log in to access your Anchor</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {errors.auth && (
              <div className="auth-error-msg" style={{ marginBottom: '1rem', textAlign: 'center' }} role="alert">
                {errors.auth}
              </div>
            )}
            
            {resetMessage && <p role="status">{resetMessage}</p>}
            {/* Email input */}
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">Email address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">✉</span>
                <input
                  id="login-email"
                  autoComplete="email"
                  type="email"
                  className={`auth-input ${errors.email ? 'auth-input--error' : ''}`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <span id="login-email-error" className="auth-error-msg" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password input */}
            <div className="auth-field">
              <div className="auth-password-header">
                <label htmlFor="login-password" className="auth-label">Password</label>
                <a href="#forgot" className="auth-link" onClick={handleResetPassword}>
                  Forgot password?
                </a>
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">🔒</span>
                <input
                  id="login-password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${errors.password ? 'auth-input--error' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && (
                <span id="login-password-error" className="auth-error-msg" role="alert">
                  {errors.password}
                </span>
              )}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="auth-switch-prompt" style={{ marginTop: '2rem' }}>
            Don't have an account?{' '}
            <button className="auth-switch-btn" onClick={() => onSwitchView('signup')}>
              Sign up
            </button>
          </div>

          <div className="auth-demo-prompt">
            <button className="auth-demo-btn" onClick={() => onSwitchView('demo')}>
              ⚡ Try with Demo Account
            </button>
          </div>
        </div>

        <div className="auth-encrypted-badge">
          <span aria-hidden="true">🔒</span> Your saved data is private to your account.
        </div>
      </div>
    </div>
  );
}

export default Login;
