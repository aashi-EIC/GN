import axios from "axios";
import { env } from "../config/env";
import { getBrowserUserId } from "../utils/browserIdentity";

export const appHttpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
});

appHttpClient.interceptors.request.use((request) => {
  request.headers.set("x-browser-user-id", getBrowserUserId());
  return request;
});

export const bffClient = appHttpClient;
