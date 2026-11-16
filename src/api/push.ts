/**
 * Phone notifications (web push) for the customer app. The service worker (public/sw.js) shows the
 * notification; the server sends it when staff message the customer.
 */
import type { PushKeyResponse, PushSubscribeRequest } from '../../shared/contract';
import { API, get, post } from './client';

export type PushState =
  /** Browser has no Push API, or the page is not on https / localhost. */
  | 'unsupported'
  /** iPhone/iPad: works only after "Add to Home Screen". */
  | 'needs-install'
  | 'off'
  | 'on'
  /** The user blocked notifications for this site. */
  | 'blocked';

const SW_URL = '/sw.js';

function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration(SW_URL)) ?? (await navigator.serviceWorker.register(SW_URL));
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!pushSupported()) return isIosBrowserTab() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Browser';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, browser].filter(Boolean).join(' · ');
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription');
  const body: PushSubscribeRequest = { subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, device: deviceLabel() };
  await post(API.pushSubscribe, body);
}

/** Ask permission, subscribe this browser and register it with the server. Returns the resulting state. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const { publicKey } = await get<PushKeyResponse>(API.pushKey);
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another server key cannot receive from this server: replace it.
  if (sub && sub.options.applicationServerKey) {
    const current = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (current !== publicKey.replace(/=+$/, '')) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await sendSubscription(sub);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await post(API.pushUnsubscribe, { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return pushState();
}

/**
 * Re-register an existing subscription after the server restarted (it may have lost its list).
 * No prompt: does nothing unless notifications are already on.
 */
export async function syncPush(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sendSubscription(sub).catch(() => undefined);
}
