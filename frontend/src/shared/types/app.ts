import type { CountryCode, ModelId } from "../../features/chat/types/semantic";

export type Density = "comfortable" | "compact";
export type MessageRole = "user" | "assistant";
export type FeedbackValue = "helpful" | "not-helpful";
export type McpResponseSource = "configured-host" | "node-bff";

export type UserProfile = {
  email: string;
  name: string;
  authProvider: "Microsoft Entra ID" | "Local Auth";
  accessToken?: string;
  tokenExpiresAt?: string;
};


export type SettingsState = {
  displayName: string;
  region: string;
  density: Density;
  keepDebugOpen: boolean;
};

export type ChartDatum = {
  label: string;
  value: number;
};

export type InsightMetric = {
  label: string;
  value: string;
  tone: "good" | "watch" | "neutral";
};

export type DebugEvent = {
  stage: string;
  status: "success" | "warning";
  detail: string;
  payload?: unknown;
};

export type TableData = {
  columns: string[];
  rows: string[][];
};

export type ChartType =
  | "line"
  | "area"
  | "bar"
  | "stacked-bar"
  | "horizontal-bar"
  | "pie"
  | "donut"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "radar"
  | "funnel"
  | "gauge";

export type ChartEncoding = {
  x?: string;
  y?: string;
  name?: string;
  value?: string;
  color?: string;
  size?: string;
};

export type ChartBlock = {
  type: "chart";
  chart_type: ChartType;
  title?: string;
  description?: string;
  data?: Array<Record<string, string | number | boolean | null>>;
  encoding?: ChartEncoding;
  option?: Record<string, unknown>;
};

export type TableBlock = {
  type: "table";
  title?: string;
  columns: Array<string | { key: string; label?: string }>;
  rows: Array<Record<string, string | number | boolean | null> | Array<string | number | boolean | null>>;
};

export type TextBlock = {
  type: "text";
  content: string;
};

export type VisualizationBlock = ChartBlock | TableBlock | TextBlock;

export type PlotSpec = {
  title: string;
  description: string;
  html: string;
};

export type McpRequestPayload = {
  user_email_id: string;
  session_id: string;
  semantic_model_id: ModelId;
  country: CountryCode;
  country_name: string;
  language?: string;
  language_name?: string;
  prompt: string;
  bearer_token_for_rls: string;
};

export type McpRequestAudit = Omit<McpRequestPayload, "bearer_token_for_rls"> & {
  bearer_token_for_rls: string;
  request_id: string;
  sent_at: string;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export type Message = {
  id: string;
  backendId?: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  chartTitle?: string;
  chart?: ChartDatum[];
  metrics?: InsightMetric[];
  table?: TableData;
  visualizations?: VisualizationBlock[];
  actions?: string[];
  debug?: DebugEvent[];
  plot?: PlotSpec;
  mcpRequest?: McpRequestAudit;
  mcpResponseSource?: McpResponseSource;
  tokenUsage?: TokenUsage;
};

export type Conversation = {
  id: string;
  title: string;
  modelId: ModelId;
  countryCode?: CountryCode;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

export type IssueReport = {
  id: string;
  category: string;
  severity: string;
  description: string;
  conversationId: string | null;
  modelId: ModelId;
  modelName: string;
  lastMessage?: Pick<Message, "id" | "role" | "text" | "createdAt">;
  createdAt: string;
};

export type ToastState = {
  message: string;
  tone: "success" | "warning";
};
