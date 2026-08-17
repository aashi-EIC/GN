import type { Request } from "express";

export type AuthenticatedUser = {
  tenantId: string;
  objectId: string;
  subject: string;
  preferredUsername?: string;
  scopes: string[];
  roles: string[];
  rawAccessToken: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  correlationId: string;
  requestSignal: AbortSignal;
};

export type McpRequestContext = {
  prompt: string;
  sessionId: string;
  semanticModelId: string;
  correlationId: string;
  user: AuthenticatedUser;
};

export type McpScalar = string | number | boolean | null;

export type McpContentBlock =
  | { type: 'text'; content: string }
  | {
      type: 'table';
      title?: string;
      columns: Array<string | { key: string; label?: string }>;
      rows: Array<Record<string, McpScalar> | McpScalar[]>;
    }
  | {
      type: 'chart';
      chart_type:
        | 'line'
        | 'area'
        | 'bar'
        | 'stacked-bar'
        | 'horizontal-bar'
        | 'pie'
        | 'donut'
        | 'scatter'
        | 'bubble'
        | 'heatmap'
        | 'radar'
        | 'funnel'
        | 'gauge';
      title?: string;
      description?: string;
      data?: Array<Record<string, McpScalar>>;
      encoding?: {
        x?: string;
        y?: string;
        name?: string;
        value?: string;
        color?: string;
        size?: string;
      };
      option?: Record<string, unknown>;
    };

export type McpHostResponse = {
  answer: {
    text: string;
    blocks?: McpContentBlock[];
  };
};
