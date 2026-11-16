/**
 * URL layout, the same as the Hydro Mobile360 demo: `/` is the server's start page, the customer
 * portal lives under `/app`, and the staff app at `/staff`. Inside the portal, routes stay short
 * ("/energy"); the router's basename adds `/app`.
 */
export const PORTAL_BASE = '/app';

export const isStaffPath = (pathname: string) => pathname === '/staff' || pathname.startsWith('/staff/');
export const isPortalPath = (pathname: string) => pathname === PORTAL_BASE || pathname.startsWith(`${PORTAL_BASE}/`);

/** Full URL path for a portal route: "/" → "/app", "/energy" → "/app/energy". */
export const portalUrl = (route: string) => (route === '/' || route === '' ? PORTAL_BASE : `${PORTAL_BASE}${route.startsWith('/') ? '' : '/'}${route}`);
