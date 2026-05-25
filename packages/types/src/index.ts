// Shared DTO contracts used by both API and Web.

export type SubjectType = 'SUPER_ADMIN' | 'AGENCY' | 'CLIENT' | 'TEAM_MEMBER';
export type TeamRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';
export type ConversationStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'SNOOZED';
export type Direction = 'INBOUND' | 'OUTBOUND';
export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'VOICE_NOTE'
  | 'DOCUMENT'
  | 'STICKER'
  | 'LOCATION'
  | 'TEMPLATE';

export type Vertical =
  | 'REAL_ESTATE'
  | 'CLINIC'
  | 'COACHING'
  | 'D2C'
  | 'HOSPITALITY'
  | 'EDUCATION'
  | 'FINANCE'
  | 'GENERAL';

export interface Principal {
  type: SubjectType;
  id: string;
  agencyId?: string;
  clientId?: string;
  role?: TeamRole;
}

export interface AuthLoginResponse {
  accessToken: string;
  expiresIn: number;
  principal: Principal;
}

export interface ContactDTO {
  id: string;
  clientId: string;
  name: string | null;
  phone: string;
  email: string | null;
  tags: string[];
  language: string;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  clientId: string;
  whatsappAccountId: string;
  contactId: string;
  contact: { id: string; name: string | null; phone: string };
  status: ConversationStatus;
  isAIEnabled: boolean;
  assignedToId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  waMessageId: string | null;
  direction: Direction;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isRead: boolean;
  sentByAI: boolean;
  sentByAgentId: string | null;
  createdAt: string;
}

export interface SendMessageDTO {
  conversationId: string;
  content: string;
  type?: 'TEXT';
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
