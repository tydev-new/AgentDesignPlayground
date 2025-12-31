
export enum ExecutionStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ConsoleLog {
  id: string;
  type: 'info' | 'error' | 'warn' | 'system' | 'verbose';
  content: string;
  timestamp: string;
}

export interface CodeSnippet {
  name: string;
  code: string;
}

export interface StorageSettings {
  geminiApiKey: string;
  isPublicGist: boolean;
}

export interface Span {
  id: string;
  name: string;
  parentId: string | null | string[]; // Support single or multiple parents (fan-in)
  input: any;
  output: any;
  status: string;
  startTime: number;
  endTime?: number;
}

export interface UserInputRequest {
  id: string;
  type: 'text' | 'confirm';
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
}
