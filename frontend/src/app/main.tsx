import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { storageKeys } from "../config/storage";
import { entraSettingsAreConfigured, msalConfig } from "../lib/msal";
import { AppRoot } from "./App";
import { AppProviders } from "./providers";
import "../styles/globals.css";

const initialTheme = localStorage.getItem(storageKeys.theme) === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = initialTheme;
document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute("content", initialTheme === "dark" ? "#25282d" : "#ffffff");

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

if (entraSettingsAreConfigured) {
  const msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();

  root.render(
    <React.StrictMode>
      <AppProviders>
        <MsalProvider instance={msalInstance}>
          <AppRoot msalEnabled />
        </MsalProvider>
      </AppProviders>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <AppProviders>
        <AppRoot msalEnabled={false} />
      </AppProviders>
    </React.StrictMode>,
  );
}
