import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import './Signup.css';

/**
 * Signup Component - Registration page for creating Anchor credentials.
 */
function Signup({ onSwitchView, theme, onToggleTheme }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Dynamic Password Validation Checklist indicators
  const [checks, setChecks] = useState({
    length: false,
    number: false,
    upper: false,
  });

  useEffect(() => {
    setChecks({
      length: password.length >= 8,
      number: /\d/.test(password),
      upper: /[A-Z]/.test(password),
    });
  }, [password]);

  function validateForm() {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else {
      if (!checks.length || !checks.number || !checks.upper) {
        newErrors.password = 'Password does not meet requirements.';
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms & Privacy Policy.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (validateForm()) {
      setLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: fullName });
        // Navigation handled by onAuthStateChanged in App.jsx
      } catch (err) {
        let authErr = 'Failed to create account.';
        if (err.code === 'auth/email-already-in-use') authErr = 'This email is already registered. Try logging in instead.';
        if (err.code === 'auth/weak-password') authErr = 'Password is too weak.';
        if (err.code === 'auth/network-request-failed') authErr = 'Unable to connect to the authentication service. Please try again.';
        setErrors({ ...errors, auth: authErr });
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="auth-container">
      {/* Theme toggle */}
      <div className="auth-theme-toggle">
        <button
          className="auth-theme-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Left side: Branding Info Panel (mirrors Login layout) */}
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
            Welcome back!<br />Let's continue<br />
            <span className="auth-hero-title-accent">your journey.</span>
          </h2>
          <p className="auth-hero-desc">
            Log in to access your personal knowledge hub.
          </p>

          <ul className="auth-features" role="list">
            <li className="auth-feature-item">
              <div className="auth-feature-icon" aria-hidden="true">📄</div>
              <div>
                <strong className="auth-feature-title">Store & organize</strong>
                <span className="auth-feature-desc">Keep all your notes, PDFs, links, images in one place.</span>
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

        <div className="auth-left-decor">
          <div className="decor-cup" aria-hidden="true">☕</div>
          <div className="decor-books" aria-hidden="true">📚</div>
        </div>
      </div>

      {/* Right side: Signup Form */}
      <div className="auth-right">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Create your Anchor account 🌿</h1>
            <p className="auth-form-subtitle">Start organizing your college life smarter.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {errors.auth && (
              <div className="auth-error-msg" style={{ marginBottom: '1rem', textAlign: 'center' }} role="alert">
                {errors.auth}
              </div>
            )}
            
            {/* Full Name */}
            <div className="auth-field">
              <label htmlFor="signup-name" className="auth-label">Full name</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">👤</span>
                <input
                  id="signup-name"
                  type="text"
                  className={`auth-input ${errors.fullName ? 'auth-input--error' : ''}`}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-invalid={!!errors.fullName}
                  aria-describedby={errors.fullName ? 'signup-name-error' : undefined}
                />
              </div>
              {errors.fullName && (
                <span id="signup-name-error" className="auth-error-msg" role="alert">
                  {errors.fullName}
                </span>
              )}
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="signup-email" className="auth-label">Email address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">✉</span>
                <input
                  id="signup-email"
                  type="email"
                  className={`auth-input ${errors.email ? 'auth-input--error' : ''}`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'signup-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <span id="signup-email-error" className="auth-error-msg" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="signup-password" className="auth-label">Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">🔒</span>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${errors.password ? 'auth-input--error' : ''}`}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'signup-password-error' : undefined}
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

              {/* Password dynamic validations checklist checklist */}
              <ul className="auth-checklist" aria-label="Password requirements">
                <li className={`auth-checklist-item ${checks.length ? 'auth-checklist-item--valid' : ''}`}>
                  <span aria-hidden="true">{checks.length ? '✓' : '○'}</span> At least 8 characters
                </li>
                <li className={`auth-checklist-item ${checks.number ? 'auth-checklist-item--valid' : ''}`}>
                  <span aria-hidden="true">{checks.number ? '✓' : '○'}</span> Includes a number
                </li>
                <li className={`auth-checklist-item ${checks.upper ? 'auth-checklist-item--valid' : ''}`}>
                  <span aria-hidden="true">{checks.upper ? '✓' : '○'}</span> Includes an uppercase letter
                </li>
              </ul>
              {errors.password && (
                <span id="signup-password-error" className="auth-error-msg" role="alert">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label htmlFor="signup-confirm" className="auth-label">Confirm password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" aria-hidden="true">🔒</span>
                <input
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input ${errors.confirmPassword ? 'auth-input--error' : ''}`}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
                />
              </div>
              {errors.confirmPassword && (
                <span id="signup-confirm-error" className="auth-error-msg" role="alert">
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="auth-field">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>
              {errors.agreeTerms && (
                <span className="auth-error-msg" role="alert">
                  {errors.agreeTerms}
                </span>
              )}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="auth-switch-prompt" style={{ marginTop: '2rem' }}>
            Already have an account?{' '}
            <button className="auth-switch-btn" onClick={() => onSwitchView('login')}>
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
