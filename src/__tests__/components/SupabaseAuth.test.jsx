import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ listener: null, unsubscribe: vi.fn(),
  getSession: vi.fn(), refreshSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock('../../config/supabase', () => ({ supabase: { auth: {
  onAuthStateChange(callback) { state.listener = callback; return { data: { subscription: { unsubscribe: state.unsubscribe } } }; },
  getSession: state.getSession, refreshSession: state.refreshSession,
  signInWithPassword: state.signInWithPassword, signUp: state.signUp,
  resetPasswordForEmail: state.resetPasswordForEmail, updateUser: state.updateUser, signOut: state.signOut,
} } }));
import { auth, subscribeAuth, getAccessToken, signUp, sendPasswordReset } from '../../services/auth';
import ResetPassword from '../../pages/ResetPassword';

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ data: { session: null }, error: null });
  state.updateUser.mockResolvedValue({ data: {}, error: null });
  state.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
  state.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  const stop = subscribeAuth(() => {}); state.listener('SIGNED_OUT', null); stop();
});

describe('Supabase session lifecycle', () => {
  it('restores verified SDK session identity and uses the access token', async () => {
    const onUser = vi.fn(); subscribeAuth(onUser);
    state.listener('INITIAL_SESSION', { user: { id: 'account-a', email: 'a@example.com', user_metadata: { name: 'Student' } } });
    expect(onUser).toHaveBeenCalledWith(expect.objectContaining({ uid: 'account-a', displayName: 'Student' }));
    state.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    expect(await auth.currentUser.getIdToken()).toBe('session-token');
    state.listener('SIGNED_OUT', null); expect(auth.currentUser).toBeNull();
  });
  it('rejects expired sessions rather than issuing an anonymous request', async () => {
    await expect(getAccessToken()).rejects.toThrow('session expired');
  });
  it('ignores malformed display-name metadata instead of breaking the application header', () => {
    subscribeAuth(() => {});
    state.listener('INITIAL_SESSION', { user: { id: 'account-a', user_metadata: { name: { invalid: true } } } });
    expect(auth.currentUser.displayName).toBe('');
  });
  it('opens password recovery on the recovery event and ignores events after disposal', () => {
    const onUser = vi.fn(), recovery = vi.fn(); const stop = subscribeAuth(onUser, vi.fn(), recovery);
    state.listener('PASSWORD_RECOVERY', { user: { id: 'account-a' } });
    expect(recovery).toHaveBeenCalledOnce(); stop();
    state.listener('SIGNED_OUT', null); expect(onUser).toHaveBeenCalledTimes(1);
  });
  it('creates the profile name atomically with signup and supports confirmation-required accounts', async () => {
    expect((await signUp('a@example.com', 'Password123', 'Student')).session).toBeNull();
    expect(state.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: { name: 'Student' } }) }));
  });
  it('uses an application recovery callback without sending server secrets', async () => {
    await sendPasswordReset('a@example.com');
    expect(state.resetPasswordForEmail).toHaveBeenCalledWith('a@example.com', { redirectTo: window.location.origin + '/?recovery=1' });
  });
});

describe('Password recovery form', () => {
  it('does not update a password through an expired recovery link', () => {
    render(<ResetPassword onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'NewPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or expired');
    expect(state.updateUser).not.toHaveBeenCalled();
  });
  it('preserves inputs on failure and confirms a successful retry', async () => {
    subscribeAuth(() => {}); state.listener('PASSWORD_RECOVERY', { user: { id: 'account-a' } });
    state.updateUser.mockResolvedValueOnce({ error: new Error('Offline') });
    render(<ResetPassword onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'NewPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update');
    expect(screen.getByLabelText('New password')).toHaveValue('NewPassword123');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('updated'));
    expect(state.updateUser).toHaveBeenLastCalledWith({ password: 'NewPassword123' });
  });
});
