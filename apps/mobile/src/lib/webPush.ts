import { Platform } from 'react-native';
import { api } from './config';

/**
 * Web push for the customer web app: phone notifications that arrive even with the browser closed.
 * The server serves the service worker at /app/sw.js (production build only), so on Expo Go or the
 * dev server these helpers report "unsupported" and do nothing.
 */
export type PushState =
  /** Not a browser, no Push API, or not served by the API server (dev). */
  | 'unsupported'
  /** iPhone/iPad in a normal Safari tab: web push needs the app added to the Home Screen first. */
  | 'needs-install'
  /** Supported; the user hasn't been asked yet. */
  | 'off'
  | 'on'
  /** The user (or the browser) blocked notifications for this site. */
  | 'blocked';

const SW_URL = '/app/sw.js';
const SCOPE = '/app/';

function hasPushApi(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Served from the API server (production), where /app/sw.js exists. */
function onAppServer(): boolean {
  return window.location.pathname.startsWith('/app');
}

export async function pushState(): Promise<PushState> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !onAppServer()) return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!hasPushApi()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/**
 * Make sure this phone is subscribed and the server knows it. Safe to call often: on sign-in, on every
 * app load and after reconnecting. Only acts once permission is granted, so it never prompts.
 */
export async function syncPush(): Promise<void> {
  if (!hasPushApi() || !onAppServer() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
  await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushKey();
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // The server makes a new key pair when it restarts without fixed keys: re-subscribe with the new one.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  const json = sub.toJSON();
  if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
    await api.pushSubscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
  }
}

/** Ask for permission (call from a tap; iOS and most browsers require it), then subscribe. */
export async function enablePush(): Promise<PushState> {
  if (!hasPushApi()) return pushState();
  const result = await Notification.requestPermission();
  if (result === 'granted') await syncPush();
  return pushState();
}

/** Stop notifications on this phone for the signed-in customer (the browser keeps its permission). */
export async function disablePush(): Promise<void> {
  if (!hasPushApi()) return;
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushUnsubscribe({ endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}

/** On sign-out: tell the server to stop sending this customer's notifications to this phone. */
export async function forgetPushOnServer(): Promise<void> {
  if (!hasPushApi()) return;
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api.pushUnsubscribe({ endpoint: sub.endpoint });
}
