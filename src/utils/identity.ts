import type { AccountInfo } from "@azure/msal-browser";
import type { UserProfile } from "../types/app";

export function accountToProfile(account?: AccountInfo): UserProfile {
  const email = account?.username || "signed.in@conversationalbi.com";
  return {
    email,
    name: account?.name || nameFromEmail(email),
    authProvider: "Microsoft Entra ID",
  };
}

export function firstName(name: string) {
  return name.split(" ")[0] || "there";
}

export function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function cloudBiEmail(cloudBiId: string) {
  return cloudBiId.includes("@") ? cloudBiId : `${cloudBiId}@cloudbi.conversationalbi.internal`;
}

export function nameFromCloudBiId(cloudBiId: string) {
  return cloudBiId
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "NI";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
