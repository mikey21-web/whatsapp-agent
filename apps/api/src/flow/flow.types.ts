/**
 * Flow node graph schema. Stored as JSON on the Flow row.
 * Executor walks node-by-node following edges from the matching trigger.
 */
export type FlowNodeKind =
  | 'TRIGGER'
  | 'SEND_MESSAGE'
  | 'CONDITION'
  | 'DELAY'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'ASSIGN'
  | 'AI_RESPOND'
  | 'WEBHOOK'
  | 'CREATE_DEAL'
  | 'MOVE_DEAL_STAGE'
  | 'UPDATE_CONTACT'
  | 'END';

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** For CONDITION nodes: 'true' or 'false'. */
  branch?: 'true' | 'false';
}

export interface FlowDoc {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Variables available to nodes during execution. */
export interface FlowContext {
  flowId: string;
  clientId: string;
  contactId: string;
  conversationId?: string;
  triggerEvent: string;
  /** Inbound message text if available. */
  message?: string;
  /** Free-form bag updated by nodes. */
  vars: Record<string, unknown>;
}
