import React from "react";
import ReactDOM from "react-dom/client";
import { storageKeys } from "../shared/config/storage";
import { AppRoot } from "./App";
import { AppProviders } from "./providers";
import "../styles/globals.css";

const initialTheme = localStorage.getItem(storageKeys.theme) === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = initialTheme;
document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute("content", initialTheme === "dark" ? "#25282d" : "#ffffff");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRoot />
    </AppProviders>
  </React.StrictMode>,
);
