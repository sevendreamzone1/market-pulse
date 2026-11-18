// Convenience UI gate only. Public Pages files remain accessible and this can be bypassed.
(() => {
  'use strict';
  const LOGIN_USERNAME = 'sarathkumar654@gmail.com';
  const PASSWORD_DIGEST = '3700adf1f25fab8202c1343c4b0b4e3fec706d57cad574086467b8b3ddf273ec';
  const SESSION_MS = 8 * 60 * 60 * 1000;
  const page = new URL(location.href);
  const base = new URL('./', page);
  const SESSION_KEY = 'marketpulse.ui-session.v2:' + base.pathname;
  const loginPage = page.pathname === new URL('login.html', base).pathname;
  function signedIn() {
    try {
      const expires = Number(localStorage.getItem(SESSION_KEY));
      return Number.isFinite(expires) && expires > Date.now() && expires <= Date.now() + SESSION_MS;
    } catch { return false; }
  }
  function destination(value) {
    try {
      const target = new URL(value || 'index.html', base);
      const paths = ['index.html', 'live.html'].map(file => new URL(file, base).pathname);
      if (target.origin === base.origin && !target.username && !target.password && paths.includes(target.pathname)) {
        target.search = '';
        if (!['#options', '#overview', '#signals'].includes(target.hash)) target.hash = '';
        return target.href;
      }
    } catch { /* Return home for malformed or external destinations. */ }
    return new URL('index.html', base).href;
  }
  function returnToLogin() {
    document.documentElement.hidden = true;
    const next = page.pathname.endsWith('/live.html') ? 'live.html' : 'index.html' + page.hash;
    const target = new URL('login.html', base);
    target.searchParams.set('next', next);
    location.replace(target.href);
  }
  if (!loginPage && !signedIn()) { returnToLogin(); return; }
  if (loginPage && signedIn()) { location.replace(destination(page.searchParams.get('next'))); return; }
  let expiryTimer;
  function watchExpiry() {
    clearTimeout(expiryTimer);
    try { expiryTimer = setTimeout(returnToLogin, Math.max(0, Number(localStorage.getItem(SESSION_KEY)) - Date.now())); }
    catch { returnToLogin(); }
  }
  if (!loginPage) watchExpiry();
  globalThis.addEventListener('storage', event => {
    if (event.key !== SESSION_KEY && event.key !== null) return;
    if (loginPage) { if (signedIn()) location.replace(destination(page.searchParams.get('next'))); return; }
    if (!signedIn()) returnToLogin();
    else watchExpiry();
  });
  function bind() {
    document.getElementById('ui-logout')?.addEventListener('click', () => {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* No session can be read when storage is blocked. */ }
      location.replace(new URL('login.html', base).href);
    });
    const form = document.getElementById('login-form');
    if (!form) return;
    const username = document.getElementById('login-username');
    const password = document.getElementById('login-password');
    const button = document.getElementById('login-submit');
    const status = document.getElementById('login-status');
    let submitting = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      submitting = true; button.disabled = true; status.textContent = 'Checking credentials…';
      const name = username.value.trim().toLowerCase();
      let value = password.value;
      password.value = '';
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
        value = '';
        const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (name !== LOGIN_USERNAME || hex !== PASSWORD_DIGEST) {
          status.textContent = 'Incorrect username or password.'; password.focus(); return;
        }
        localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS));
        if (!signedIn()) throw Error('Storage unavailable');
        status.textContent = 'Signed in. Opening your workspace…';
        location.replace(destination(page.searchParams.get('next')));
      } catch {
        status.textContent = 'Sign-in could not complete. Use HTTPS and allow browser storage, then try again.';
      } finally { value = ''; submitting = false; button.disabled = false; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();
