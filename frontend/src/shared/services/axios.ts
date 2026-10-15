import axios from "axios";
import { env } from "../config/env";
import { getBrowserUserId } from "../utils/browserIdentity";

import { getAuthToken } from "./tokenStore";

export const appHttpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
});

appHttpClient.interceptors.request.use(async (request) => {
  request.headers.set("x-browser-user-id", getBrowserUserId());
  const token = await getAuthToken();
  if (token) {
    request.headers.set("authorization", `Bearer ${token}`);
  }
  return request;
});

export const bffClient = appHttpClient;
