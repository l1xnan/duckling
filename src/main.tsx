import { attachConsole } from '@tauri-apps/plugin-log';
import React from 'react';
import ReactDOM from 'react-dom/client';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import App from './App';
import './app/globals.css';
import './styles.css';

dayjs.extend(utc);
dayjs.extend(timezone);

// with LogTarget::Webview enabled this function will print logs to the browser console
(async () => {
  const detach = await attachConsole();
  detach();
})();

// disable right-click context menu
document.oncontextmenu = function () {
  return false;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
