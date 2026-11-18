import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <main className="app-fatal" role="alert">
        <h1>Anchor could not load this page</h1>
        <p>Reload to try again. Your saved resources and tasks are safe.</p>
        <button onClick={() => window.location.reload()}>Reload Anchor</button>
      </main>;
    }
    return this.props.children;
  }
}
