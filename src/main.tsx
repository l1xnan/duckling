import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { attachConsole } from "@tauri-apps/plugin-log";

// with LogTarget::Webview enabled this function will print logs to the browser console
attachConsole().then((detach) => {
  detach();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
