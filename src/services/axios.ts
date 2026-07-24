import axios from "axios";
import { env } from "../config/env";

export const appHttpClient = axios.create({
  timeout: 30000,
});

export const bffClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30000,
});
