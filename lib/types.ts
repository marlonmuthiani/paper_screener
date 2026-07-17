export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Depth = "plain" | "rigorous";

export type HighlightStatus = "streaming" | "done" | "error";

export interface Highlight {
  id: string;
  text: string;
  page: number;
  createdAt: number;
  depth: Depth;
  messages: ChatMessage[];
  status: HighlightStatus;
  error?: string;
}

export interface ExplainRequest {
  context: string;
  messages: ChatMessage[];
}
