'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatRelative } from '@/lib/utils';
import type { ConversationDTO, MessageDTO } from '@diyaa/types';
import { Bot, BotOff, CheckCircle2, Zap, IndianRupee } from 'lucide-react';
import { OnboardingChecklist } from '@/components/onboarding-checklist';

interface QuickReply {
  id: string;
  shortcut: string;
  body: string;
}
interface PresenceAgent { id: string; name: string }

export default function InboxPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<ConversationDTO[]>('/conversations'),
    refetchInterval: 15_000,
  });

  const { data: quickReplies } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: () => api<QuickReply[]>('/quick-replies'),
  });

  useEffect(() => {
    const s = getSocket();
    function onCreated(payload: { conversationId: string; clientId: string; message: MessageDTO }) {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.setQueryData<MessageDTO[]>(['messages', payload.conversationId], (prev) =>
        prev ? [payload.message, ...prev.filter((m) => m.id !== payload.message.id)] : prev,
      );
    }
    s.on('message.created', onCreated);
    return () => {
      s.off('message.created', onCreated);
    };
  }, [qc]);

  useEffect(() => {
    if (!selectedId && conversations && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const s = getSocket();
    s.emit('conversation:join', { conversationId: selectedId });
    const prev = selectedId;
    return () => {
      s.emit('conversation:leave', { conversationId: prev });
    };
  }, [selectedId]);

  const selected = conversations?.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full flex-col">
      <OnboardingChecklist />
      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="flex flex-1 flex-col">
          {selectedId && selected ? (
            <ChatWindow conversation={selected} quickReplies={quickReplies ?? []} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="hidden w-80 flex-col border-r border-border md:flex">
      <div className="border-b border-border p-3 font-medium">Inbox</div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No conversations yet. They appear when WhatsApp users message your number.
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'flex w-full flex-col gap-1 border-b border-border px-3 py-3 text-left hover:bg-muted',
              selectedId === c.id && 'bg-muted',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.contact?.name ?? c.contact?.phone}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(c.lastMessageAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="truncate text-xs text-muted-foreground">
                {c.lastMessagePreview ?? '—'}
              </span>
              {c.isAIEnabled && <Bot size={12} className="text-[var(--brand)]" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatWindow({
  conversation, quickReplies,
}: {
  conversation: ConversationDTO;
  quickReplies: QuickReply[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [presence, setPresence] = useState<PresenceAgent[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: messages } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () =>
      api<MessageDTO[]>(`/messages?conversationId=${encodeURIComponent(conversation.id)}`),
  });

  const ordered = useMemo(() => (messages ? [...messages].reverse() : []), [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [ordered.length]);

  useEffect(() => {
    const s = getSocket();
    function onJoined(p: { conversationId: string; agent: PresenceAgent }) {
      if (p.conversationId !== conversation.id) return;
      setPresence((prev) =>
        prev.find((a) => a.id === p.agent.id) ? prev : [...prev, p.agent],
      );
    }
    function onLeft(p: { conversationId: string; agent: PresenceAgent }) {
      if (p.conversationId !== conversation.id) return;
      setPresence((prev) => prev.filter((a) => a.id !== p.agent.id));
    }
    function onTyping(p: { conversationId: string; isTyping: boolean; agent: PresenceAgent }) {
      if (p.conversationId !== conversation.id) return;
      setTyping((prev) => {
        const next = { ...prev };
        if (p.isTyping) next[p.agent.id] = p.agent.name;
        else delete next[p.agent.id];
        return next;
      });
    }
    s.on('presence:joined', onJoined);
    s.on('presence:left', onLeft);
    s.on('typing', onTyping);
    return () => {
      s.off('presence:joined', onJoined);
      s.off('presence:left', onLeft);
      s.off('typing', onTyping);
    };
  }, [conversation.id]);

  const toggleAi = useMutation({
    mutationFn: (next: boolean) =>
      api(`/conversations/${conversation.id}/ai`, {
        method: 'PATCH',
        json: { isAIEnabled: next },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const resolveMut = useMutation({
    mutationFn: () => api(`/conversations/${conversation.id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  function emitTyping(isTyping: boolean) {
    const s = getSocket();
    s.emit('typing', { conversationId: conversation.id, isTyping });
  }

  function onDraftChange(next: string) {
    setDraft(next);

    // Quick-reply expansion: if user types "/shortcut " expand to body.
    const m = /^\/(\S+)\s$/.exec(next);
    if (m) {
      const found = quickReplies.find((q) => q.shortcut === m[1]!.toLowerCase());
      if (found) {
        setDraft(found.body);
        setShowQuickReplies(false);
        return;
      }
    }
    setShowQuickReplies(next.startsWith('/'));

    // Typing indicator throttle.
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1500);
  }

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    emitTyping(false);
    try {
      const m = await api<MessageDTO>('/messages', {
        method: 'POST',
        json: { conversationId: conversation.id, content },
      });
      qc.setQueryData<MessageDTO[]>(['messages', conversation.id], (prev) =>
        prev ? [m, ...prev] : [m],
      );
    } catch (e) {
      setDraft(content);
      console.error(e);
    }
  }

  const filteredReplies = quickReplies.filter((q) =>
    draft.startsWith('/') ? q.shortcut.includes(draft.slice(1).toLowerCase()) : true,
  );
  const typingNames = Object.values(typing);
  const otherPresence = presence;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="font-medium">{conversation.contact.name ?? conversation.contact.phone}</div>
          <div className="text-xs text-muted-foreground">{conversation.contact.phone}</div>
          {otherPresence.length > 0 && (
            <div className="mt-0.5 text-xs text-amber-700">
              Also viewing: {otherPresence.map((a) => a.name).join(', ')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAi.mutate(!conversation.isAIEnabled)}
          >
            {conversation.isAIEnabled ? (
              <><Bot size={14} className="mr-1" /> AI on</>
            ) : (
              <><BotOff size={14} className="mr-1" /> AI off</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => resolveMut.mutate()}>
            <CheckCircle2 size={14} className="mr-1" /> Resolve
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {ordered.map((m) => (
          <div
            key={m.id}
            className={cn(
              'mb-2 flex w-full',
              m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-md rounded-lg px-3 py-2 text-sm',
                m.direction === 'OUTBOUND'
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-muted text-foreground',
              )}
            >
              <div>{m.content ?? `[${m.type}]`}</div>
              <div
                className={cn(
                  'mt-1 flex items-center gap-1 text-[10px] opacity-70',
                  m.direction === 'OUTBOUND' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                {m.sentByAI && <Bot size={10} />}
                <span>{formatRelative(m.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {typingNames.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--brand)]" />
            <span>{typingNames.join(', ')} typing…</span>
          </div>
        )}
      </div>

      <div className="relative border-t border-border p-3">
        {showQuickReplies && filteredReplies.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 max-h-56 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
            {filteredReplies.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setDraft(q.body);
                  setShowQuickReplies(false);
                }}
                className="block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <div className="font-mono text-xs text-[var(--brand)]">/{q.shortcut}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{q.body}</div>
              </button>
            ))}
          </div>
        )}
        {showPayment && (
          <PaymentLinkPopover
            conversationId={conversation.id}
            onClose={() => setShowPayment(false)}
          />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickReplies((v) => !v)}
            aria-label="Quick replies"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          >
            <Zap size={16} />
          </button>
          <button
            onClick={() => setShowPayment((v) => !v)}
            aria-label="Send payment link"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          >
            <IndianRupee size={16} />
          </button>
          <Input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Type / to insert a quick reply…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button onClick={() => void send()}>Send</Button>
        </div>
      </div>
    </>
  );
}


function PaymentLinkPopover({
  conversationId, onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<{ shortUrl: string }>('/payment-links', {
        method: 'POST',
        json: {
          conversationId,
          amountInr: Number(amount),
          description,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="absolute bottom-full left-3 right-3 mb-2 rounded-md border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Send payment link</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground">Cancel</button>
      </div>
      <div className="grid grid-cols-[120px_1fr_auto] items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Amount (INR)</label>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="999"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Order #1234"
            maxLength={200}
          />
        </div>
        <Button
          onClick={() => create.mutate()}
          disabled={!amount || !description || Number(amount) < 1 || create.isPending}
        >
          {create.isPending ? 'Creating…' : 'Send'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
