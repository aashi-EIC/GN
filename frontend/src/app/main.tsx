import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "./App";
import { AppProviders } from "./providers";
import { ModelCatalogLoader } from "./ModelCatalogLoader";
import { storageKeys } from "../shared/config/storage";
import { getBrowserUserId } from "../shared/utils/browserIdentity";
import "../styles/globals.css";

try {
  const initialTheme = localStorage.getItem(storageKeys.theme) === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = initialTheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", initialTheme === "dark" ? "#050b14" : "#ffffff");
} catch {
  document.documentElement.dataset.theme = "light";
}

getBrowserUserId();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <ModelCatalogLoader>
        <AppRoot />
      </ModelCatalogLoader>
    </AppProviders>
  </React.StrictMode>,
);
