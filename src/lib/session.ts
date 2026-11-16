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

export function signOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
