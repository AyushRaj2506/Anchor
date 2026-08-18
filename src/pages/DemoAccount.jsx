import React from 'react';
import './DemoAccount.css';

/**
 * DemoAccount Component - Allows instant exploration of Anchor features with mock data.
 */
function DemoAccount({ onDemoLogin, onSwitchView, theme, onToggleTheme }) {
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

      {/* Left side: Branding Info Panel (mirrors Login/Signup layout) */}
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

      {/* Right side: Demo Account Card */}
      <div className="auth-right">
        <div className="auth-form-card demo-card">
          <div className="demo-header-badge" role="status">
            <span aria-hidden="true">⭐</span> New here?
          </div>

          <div className="auth-form-header">
            <h1 className="auth-form-title">Try Anchor with Demo Account</h1>
            <p className="auth-form-subtitle">Explore all features instantly with sample data.</p>
          </div>

          {/* Styled backpack graphics illustration */}
          <div className="demo-graphic-area" aria-hidden="true">
            <div className="demo-graphic-backpack">🎒</div>
            <div className="demo-graphic-notepad">📝</div>
          </div>

          {/* Checklist features highlights */}
          <ul className="demo-checklist" role="list">
            <li className="demo-checklist-item">
              <span className="demo-checklist-check" aria-hidden="true">✓</span>
              <div>
                <strong className="demo-checklist-title">Explore all features</strong>
                <span className="demo-checklist-desc">Test everything Anchor can do</span>
              </div>
            </li>
            <li className="demo-checklist-item">
              <span className="demo-checklist-check" aria-hidden="true">✓</span>
              <div>
                <strong className="demo-checklist-title">Sample college data</strong>
                <span className="demo-checklist-desc">Notes, PDFs, tasks & more</span>
              </div>
            </li>
            <li className="demo-checklist-item">
              <span className="demo-checklist-check" aria-hidden="true">✓</span>
              <div>
                <strong className="demo-checklist-title">No sign up required</strong>
                <span className="demo-checklist-desc">Jump in and start using Anchor</span>
              </div>
            </li>
            <li className="demo-checklist-item">
              <span className="demo-checklist-check" aria-hidden="true">✓</span>
              <div>
                <strong className="demo-checklist-title">Safe & private</strong>
                <span className="demo-checklist-desc">Demo data is separate and secure</span>
              </div>
            </li>
          </ul>

          <div className="demo-actions">
            <button
              type="button"
              className="auth-submit-btn demo-submit-btn"
              onClick={onDemoLogin}
            >
              ▶ Continue with Demo Account
            </button>

            <button
              type="button"
              className="auth-google-btn demo-back-btn"
              onClick={() => onSwitchView('login')}
            >
              ← Go back to Log in
            </button>
          </div>

          <div className="demo-warning-footer">
            <span aria-hidden="true">ℹ</span> Demo progress will not be saved. Create an account to save your data.
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoAccount;
