export interface DialogAnalysisMode {
  type: 'dialog-analysis';
  file?: File;
}

export interface InteractiveMode {
  type: 'interactive';
  subMode: 'default-chat' | 'custom-workflow';
  workflowFile?: File;
}

export type DashboardMode = DialogAnalysisMode | InteractiveMode;

export interface ConversationLog {
  id: string;
  timestamp: string;
  user: string;
  ai: string;
  type: 'user' | 'ai';
  content: string;
}

export interface ModelInfo {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

export interface FlaggedContent {
  id: string;
  messageId: string;
  type: 'ethical-concern' | 'harmful-content' | 'misinformation' | 'bias' | 'none' | 'other';
  severity: 'low' | 'medium' | 'high';
  reason: string;
  flaggedText: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface FlaggingAnalysis {
  id: string;
  messageId: string;
  shouldFlag: boolean;
  flags: FlaggedContent[];
  reasoning: string;
  analysisTimestamp: Date;
}

export interface ContentTypeSeverity {
  type: FlaggedContent['type'];
  severity: FlaggedContent['severity'] | null;
  found: boolean;
}

export interface Principle {
  id: string;
  name: string;
  description: string;
}

export interface PrincipleScore {
  id: string;
  messageId: string;
  principleId: string;
  score: number; // -5 to 5
  reasoning: string;
  timestamp: Date;
}

export interface PrincipleScoring {
  id: string;
  messageId: string;
  scores: PrincipleScore[];
  analysisTimestamp: Date;
}

export interface PrincipleVisualizationData {
  principleId: string;
  principleName: string;
  userScores: { messageIndex: number; score: number; timestamp: Date; reasoning: string }[];
  aiScores: { messageIndex: number; score: number; timestamp: Date; reasoning: string }[];
}
