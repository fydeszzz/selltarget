import React from 'react';
import ReactDOM from 'react-dom/client';

// Entry for the packaged app (Capacitor iOS/Android + Electron; web.html has
// its own entry). Phones get the phone-frame App; a native iPad gets the web
// two-column layout (WebApp) instead, so the big screen isn't wasted on a
// stretched phone UI. Detection: native iOS whose shorter screen side is
// iPad-class (iPad mini is 744pt; the widest iPhone is 440pt), with a UA
// check as backup — iPadOS WebViews often masquerade as Mac in the UA, which
// is why the size check is the primary signal.
const cap = window.Capacitor;
const isNativeIos = !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios';
// Dev-only escape hatch to exercise the pad branch in a desktop browser:
// sessionStorage.setItem('selltarget:forcePad', '1') then reload. Stripped
// from production builds via import.meta.env.DEV.
const devForcePad =
  import.meta.env.DEV &&
  (() => { try { return sessionStorage.getItem('selltarget:forcePad') === '1'; } catch { return false; } })();
const isNativePad =
  devForcePad ||
  (isNativeIos &&
    (Math.min(window.screen.width, window.screen.height) >= 700 ||
      /iPad/i.test(navigator.userAgent)));

async function boot() {
  // Dynamic imports keep the two UIs code-split: each device downloads and
  // parses only the bundle (and CSS) it actually renders.
  const [{ default: Root }] = isNativePad
    ? await Promise.all([import('./web/WebApp.jsx'), import('./web/web.css')])
    : await Promise.all([import('./App.jsx'), import('./styles.css')]);

  if (isNativePad) document.documentElement.classList.add('native-pad');

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root {...(isNativePad ? { nativePad: true } : {})} />
    </React.StrictMode>,
  );
}

boot();
