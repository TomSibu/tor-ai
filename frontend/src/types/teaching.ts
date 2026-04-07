// Teaching-related API types

export interface PresentationState {
  session_id: number;
  current_sentence: string;
  progress: number;
  total_sentences: number;
  current_index: number;
  is_paused: boolean;
  is_active: boolean;
}

export interface QuestionRequest {
  question: string;
  student_id?: number;
}

export interface NavigateRequest {
  action: "next" | "prev" | "jump";
  target?: number;
}

export interface QAStreamEvent {
  type: "text" | "complete" | "error";
  content?: string;
  timestamp?: string;
}

export interface TeachingSessionStartResponse {
  session_id: number;
  status: string;
  current_sentence: string;
  progress: number;
  total_sentences: number;
}

export interface TeachingSessionState {
  session_id: number;
  current_sentence: string;
  progress: number;
  total_sentences: number;
  is_paused: boolean;
  is_active: boolean;
}

export interface NavigateResponse {
  current_sentence: string;
  progress: number;
  total_sentences: number;
}

export interface PauseResponse {
  is_paused: boolean;
  session_id: number;
}

export interface EndSessionResponse {
  message: string;
  session_id: number;
}
