import { isPortalPath } from './routes';

/**
 * On a laptop the customer app is shown the way the Hydro Mobile360 customer app is: a phone-width
 * column in the middle of a dark page. The column is an iframe of the app itself, so everything
 * inside (phone layout, fixed tab bar, full-screen chat) behaves exactly as on a real phone.
 */
export const PHONE_FRAME_MIN_WIDTH = 700;

const NO_FRAME = 'engie-demo-noframe';

/** Top-level window on a wide screen: show the phone column instead of the app itself. */
export function wantsPhoneFrame(): boolean {
  try {
    if (sessionStorage.getItem(NO_FRAME)) return false;
  } catch {
    /* no storage: try the column */
  }
  return window.self === window.top && window.matchMedia(`(min-width: ${PHONE_FRAME_MIN_WIDTH}px)`).matches;
}

/**
 * The phone column could not be shown because the host refuses to let the app be framed. Rather than leave
 * an empty column, remember that for this tab and load the app itself.
 */
export function giveUpPhoneFrame(): void {
  try {
    sessionStorage.setItem(NO_FRAME, '1');
  } catch {
    return; // cannot remember it, so a reload would only repeat the problem
  }
  window.location.reload();
}

/** Keep the address bar on the screen shown in the phone column, so reload and copied links work. */
export function syncFrameUrl(): void {
  try {
    // Only when the parent is the phone column of the customer app.
    if (window.self === window.parent || !isPortalPath(window.parent.location.pathname)) return;
    const { pathname, search, hash } = window.location;
    window.parent.history.replaceState(null, '', `${pathname}${search}${hash}`);
  } catch {
    /* parent not reachable: nothing to sync */
  }
}
