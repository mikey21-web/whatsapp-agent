import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, Principal } from '../auth/principal';
import { env } from '../config/env';

interface AuthedSocket extends Socket {
  data: { principal?: Principal };
}

interface PresencePayload {
  conversationId: string;
  agent: { id: string; name: string };
}

@WebSocketGateway({
  cors: { origin: env.WEB_ORIGIN.split(','), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: AuthedSocket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace(/^Bearer /, '') as string | undefined);
      if (!token) throw new Error('no-token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const principal = toPrincipal(payload);
      socket.data.principal = principal;

      switch (principal.type) {
        case 'TEAM_MEMBER':
        case 'CLIENT':
          if ('clientId' in principal) socket.join(`client:${principal.clientId}`);
          else if (principal.type === 'CLIENT') socket.join(`client:${principal.id}`);
          break;
        case 'AGENCY':
          socket.join(`agency:${principal.id}`);
          break;
        case 'SUPER_ADMIN':
          socket.join('superadmin');
          break;
      }
    } catch (e) {
      this.logger.warn(`socket reject: ${(e as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: AuthedSocket) {}

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const principal = socket.data.principal;
    if (!principal) return { ok: false };
    const clientId = principalClientId(principal);
    if (!clientId) return { ok: false };
    const conv = await this.prisma.conversation.findUnique({
      where: { id: body.conversationId },
      select: { id: true, clientId: true },
    });
    if (!conv || conv.clientId !== clientId) return { ok: false };
    socket.join(`conversation:${conv.id}`);

    // Announce presence to the other agents in the conversation.
    const agent = await agentLabel(this.prisma, principal);
    socket.to(`conversation:${conv.id}`).emit('presence:joined', {
      conversationId: conv.id,
      agent,
    } satisfies PresencePayload);
    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const principal = socket.data.principal;
    if (!principal) return { ok: false };
    const clientId = principalClientId(principal);
    if (!clientId) return { ok: false };
    // Only leave rooms the socket actually joined (prevents presence spam to foreign convs).
    const roomName = `conversation:${body.conversationId}`;
    if (!socket.rooms.has(roomName)) return { ok: false };
    socket.leave(roomName);
    const agent = await agentLabel(this.prisma, principal);
    socket.to(roomName).emit('presence:left', {
      conversationId: body.conversationId,
      agent,
    } satisfies PresencePayload);
    return { ok: true };
  }

  /** Browser sends typing pings; we relay to others in the conversation room. */
  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const principal = socket.data.principal;
    if (!principal) return;
    const clientId = principalClientId(principal);
    if (!clientId) return;
    // Only relay typing if the socket is actually in the conversation room.
    const roomName = `conversation:${body.conversationId}`;
    if (!socket.rooms.has(roomName)) return;
    const agent = await agentLabel(this.prisma, principal);
    socket.to(roomName).emit('typing', {
      conversationId: body.conversationId,
      isTyping: body.isTyping,
      agent,
    });
  }

  // ── Server emit helpers ──

  emitMessageCreated(payload: { clientId: string; conversationId: string; message: unknown }) {
    this.server.to(`client:${payload.clientId}`).emit('message.created', payload);
    this.server.to(`conversation:${payload.conversationId}`).emit('message.created', payload);
  }

  emitConversationUpdated(payload: { clientId: string; conversation: unknown }) {
    this.server.to(`client:${payload.clientId}`).emit('conversation.updated', payload);
  }
}

async function agentLabel(
  prisma: PrismaService,
  p: Principal,
): Promise<{ id: string; name: string }> {
  if (p.type === 'TEAM_MEMBER') {
    const m = await prisma.teamMember.findUnique({
      where: { id: p.id },
      select: { name: true },
    });
    return { id: p.id, name: m?.name ?? 'Agent' };
  }
  if (p.type === 'CLIENT') return { id: p.id, name: 'Owner' };
  return { id: p.id, name: 'Agent' };
}

function principalClientId(p: Principal): string | undefined {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  return undefined;
}

function toPrincipal(p: AccessTokenPayload): Principal {
  switch (p.type) {
    case 'SUPER_ADMIN':
      return { type: 'SUPER_ADMIN', id: p.sub };
    case 'AGENCY':
      return { type: 'AGENCY', id: p.sub };
    case 'CLIENT':
      return { type: 'CLIENT', id: p.sub, agencyId: p.agencyId! };
    case 'TEAM_MEMBER':
      return {
        type: 'TEAM_MEMBER',
        id: p.sub,
        clientId: p.clientId!,
        agencyId: p.agencyId!,
        role: p.role!,
      };
  }
}
