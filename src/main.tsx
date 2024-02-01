import { attachConsole } from '@tauri-apps/plugin-log';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './app/globals.css';
// with LogTarget::Webview enabled this function will print logs to the browser console
(async () => {
  const detach = await attachConsole();
  detach();
})();

// disable right-click context menu
document.oncontextmenu = function () {
  return false;
};

const isDev = import.meta.env.MODE === 'development';

if (!isDev) {
  (async () => {
    const update = await check();
    console.log(update);
    if (update?.version != update?.currentVersion) {
      await update?.downloadAndInstall();
      await relaunch();
    }
  })();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
