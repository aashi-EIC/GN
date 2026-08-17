import { getPool } from "../postgres/pool.js";
import type { AuthenticatedUser } from "../../types.js";

export async function getUserSettings(user: AuthenticatedUser) {
  const result = await getPool().query(
    'SELECT display_name as "displayName", region, density, keep_debug_open as "keepDebugOpen", theme, tour_seen as "tourSeen" FROM user_settings WHERE owner_tenant_id=$1 AND owner_object_id=$2',
    [user.tenantId, user.objectId],
  );
  if (!result.rowCount) {
    return {
      displayName: "",
      region: "Global",
      density: "comfortable",
      keepDebugOpen: false,
      theme: "light",
      tourSeen: false,
    };
  }
  return result.rows[0];
}

export interface UserSettingsInput {
  displayName?: string;
  region?: string;
  density?: string;
  keepDebugOpen?: boolean;
  theme?: string;
  tourSeen?: boolean;
}

export interface FeedbackInput {
  messageId: string;
  value: string;
  comment?: string;
}

export interface IssueInput {
  id: string;
  title: string;
  description: string;
  debugContext?: unknown;
}

export async function saveUserSettings(user: AuthenticatedUser, settings: UserSettingsInput) {
  await getPool().query(
    `INSERT INTO user_settings(owner_tenant_id, owner_object_id, display_name, region, density, keep_debug_open, theme, tour_seen, updated_at)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (owner_tenant_id, owner_object_id)
     DO UPDATE SET display_name=$3, region=$4, density=$5, keep_debug_open=$6, theme=$7, tour_seen=$8, updated_at=NOW()`,
    [
      user.tenantId,
      user.objectId,
      settings.displayName || "",
      settings.region || "Global",
      settings.density || "comfortable",
      settings.keepDebugOpen || false,
      settings.theme || "light",
      settings.tourSeen || false,
    ],
  );
}

export async function saveMessageFeedback(user: AuthenticatedUser, feedback: FeedbackInput) {
  // Validate that the message belongs to a session owned by this user
  const msgCheck = await getPool().query(
    `SELECT m.id FROM chat_messages m
     JOIN chat_sessions s ON m.session_id = s.id
     WHERE m.id = $1 AND s.owner_tenant_id = $2 AND s.owner_object_id = $3`,
    [feedback.messageId, user.tenantId, user.objectId],
  );
  if (!msgCheck.rowCount) {
    throw new Error("Message not found or access denied");
  }

  await getPool().query(
    `INSERT INTO message_feedback(message_id, owner_tenant_id, owner_object_id, value, comment, updated_at)
     VALUES($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (message_id)
     DO UPDATE SET value=$4, comment=$5, updated_at=NOW()`,
    [feedback.messageId, user.tenantId, user.objectId, feedback.value, feedback.comment || ""],
  );
}

export async function saveIssueReport(user: AuthenticatedUser, issue: IssueInput) {
  await getPool().query(
    `INSERT INTO issue_reports(id, owner_tenant_id, owner_object_id, title, description, debug_context)
     VALUES($1, $2, $3, $4, $5, $6)`,
    [
      issue.id,
      user.tenantId,
      user.objectId,
      issue.title,
      issue.description,
      JSON.stringify(issue.debugContext || {}),
    ],
  );
}
