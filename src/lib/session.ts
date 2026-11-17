/**
 * Demo sign-in for the customer app. Any password works for the sample customer; the session is just
 * a flag in localStorage so the phone stays signed in across reloads and demo resets.
 */
import { customer } from '../data/customer';

const KEY = 'engie-demo-session';

export function isSignedIn(): boolean {
  try {
    return localStorage.getItem(KEY) === customer.id;
  } catch {
    return false;
  }
}

/** Accepts the demo customer's email or customer number (spaces ignored), with any non-empty password. */
export function checkLogin(login: string, password: string): boolean {
  const id = login.trim().toLowerCase().replace(/\s+/g, '');
  return password.length > 0 && (id === customer.email.toLowerCase() || id === customer.customerNo.replace(/\s+/g, ''));
}

export function signIn(): void {
  try {
    localStorage.setItem(KEY, customer.id);
  } catch {
    /* storage unavailable: signed in for this page only */
  }
}

const STARTED = 'engie-demo-started';

/**
 * True once per app launch: the first time this is asked after the customer app was opened fresh (the app
 * was closed or swiped away, or opened in a new tab). A reload of the running app is not a fresh launch,
 * because the browser keeps sessionStorage for it. The staff app's own phone view never counts as a launch.
 */
export function isFreshLaunch(): boolean {
  try {
    if (sessionStorage.getItem(STARTED)) return false;
    sessionStorage.setItem(STARTED, '1');
    return !(window.top !== window.self && window.top?.location.pathname.startsWith('/staff'));
  } catch {
    return false;
  }
}

export function signOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
