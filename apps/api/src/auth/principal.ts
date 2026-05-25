export type SubjectType = 'SUPER_ADMIN' | 'AGENCY' | 'CLIENT' | 'TEAM_MEMBER';
export type TeamRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

export type Principal =
  | { type: 'SUPER_ADMIN'; id: string }
  | { type: 'AGENCY'; id: string }
  | { type: 'CLIENT'; id: string; agencyId: string }
  | {
      type: 'TEAM_MEMBER';
      id: string;
      clientId: string;
      agencyId: string;
      role: TeamRole;
    };

export interface AccessTokenPayload {
  sub: string;
  type: SubjectType;
  agencyId?: string;
  clientId?: string;
  role?: TeamRole;
}
