import axios from "axios";
import { appHttpClient } from "../../../shared/services/axios";
import type { UserProfile } from "../../../shared/types/app";

type PasswordLoginResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  access_token?: string;
  expires_in?: number;
  user?: {
    email?: string;
    name?: string;
  };
};

export async function signInWithPassword(
  username: string,
  password: string,
): Promise<UserProfile> {
  try {
    const response = await appHttpClient.post<PasswordLoginResponse>("/auth/login", {
      username,
      password,
    });
    const result = response.data;

    if (!result.success) {
      throw new Error(result.message || "Invalid email or password.");
    }

    const expiresInSeconds = result.expires_in;
    return {
      email: result.user?.email || username,
      name: result.user?.name || username.split("@")[0] || username,
      authProvider: "Local Auth",
      accessToken: result.access_token || result.token,
      tokenExpiresAt: expiresInSeconds
        ? new Date(Date.now() + expiresInSeconds * 1_000).toISOString()
        : undefined,
    };
  } catch (error) {
    if (axios.isAxiosError<PasswordLoginResponse>(error)) {
      if (!error.response) {
        throw new Error("Cannot connect to the authentication service.");
      }
      throw new Error(error.response.data?.message || "Invalid email or password.");
    }
    throw error;
  }
}
