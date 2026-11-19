import { supabase } from '../config/supabase';

let currentUser = null;
function normalized(user) {
  const metadata = user?.user_metadata || {};
  return user ? { uid: user.id, email: user.email,
    displayName: typeof metadata.name === 'string' ? metadata.name : typeof metadata.full_name === 'string' ? metadata.full_name : '',
    getIdToken: getAccessToken } : null;
}
export const auth = supabase ? { get currentUser() { return currentUser; } } : null;
function client() {
  if (!supabase) throw new Error('Authentication is not configured.');
  return supabase;
}
export function subscribeAuth(onUser, onError, onRecovery) {
  if (!supabase) { onUser(null); return () => {}; }
  let active = true;
  // INITIAL_SESSION is emitted by the SDK after persisted-session restoration.
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (!active) return;
    currentUser = normalized(session?.user);
    if (event === 'PASSWORD_RECOVERY') onRecovery?.();
    onUser(currentUser);
  });
  // Surface initialization errors without starting a second competing listener.
  supabase.auth.getSession().then(({ error }) => { if (error && active) onError?.(error); })
    .catch(error => { if (active) onError?.(error); });
  return () => { active = false; data.subscription.unsubscribe(); };
}
export async function getAccessToken(forceRefresh = false) {
  const { data, error } = forceRefresh ? await client().auth.refreshSession() : await client().auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Your session expired. Please sign in again.');
  return data.session.access_token;
}
export async function signIn(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signUp(email, password, name) {
  const { data, error } = await client().auth.signUp({ email, password,
    options: { data: { name }, emailRedirectTo: window.location.origin } });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
export async function sendPasswordReset(email) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?recovery=1' });
  if (error) throw error;
}
export async function updatePassword(password) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}
