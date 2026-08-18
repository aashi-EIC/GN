import axios from "axios";
import { env } from "../config/env";

export const appHttpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
});

export const bffClient = appHttpClient;
