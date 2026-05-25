import { describe, expect, it } from 'vitest';

function buildSystemPrompt(
  agent: { name: string; persona: string; systemPrompt: string; language: string[] },
  businessName: string,
  kbBlock: string,
): string {
  const today = '2025-05-25';
  const langs = agent.language.join(', ');
  return [
    `You are ${agent.name}, a ${agent.persona} for ${businessName}.`,
    '',
    `LANGUAGE: Respond in the same language the customer writes. Supported: ${langs}.`,
    'If the customer writes in Hindi, respond in Hindi. If Telugu, respond in Telugu. Otherwise English.',
    '',
    'YOUR ROLE:',
    agent.systemPrompt,
    kbBlock,
    '',
    'RULES:',
    '1. Never claim to be a human. If asked, say you are an AI assistant.',
    '2. If you cannot answer something, say "Let me connect you with our team" and stop.',
    '3. Keep responses concise. Max 3 sentences unless explaining something complex.',
    '4. Never share pricing unless it is in the knowledge base.',
    '5. End qualification conversations with a clear next step.',
    '',
    `TODAY: ${today}`,
  ].join('\n');
}

describe('AI agent system prompt builder', () => {
  const agent = {
    name: 'Priya',
    persona: 'real estate consultant',
    systemPrompt: 'Qualify buyers by asking budget and location.',
    language: ['en', 'hi', 'te'],
  };

  it('embeds the agent name and persona', () => {
    const p = buildSystemPrompt(agent, 'Acme Realty', '');
    expect(p).toContain('Priya');
    expect(p).toContain('real estate consultant');
    expect(p).toContain('Acme Realty');
  });

  it('lists supported languages', () => {
    const p = buildSystemPrompt(agent, 'Biz', '');
    expect(p).toContain('en, hi, te');
  });

  it('includes the custom system prompt', () => {
    const p = buildSystemPrompt(agent, 'Biz', '');
    expect(p).toContain('Qualify buyers by asking budget and location.');
  });

  it('includes KB block when provided', () => {
    const kb = '\n\nKNOWLEDGE BASE CONTEXT:\n[1] FAQ\nWe are open Mon-Sat.';
    const p = buildSystemPrompt(agent, 'Biz', kb);
    expect(p).toContain('KNOWLEDGE BASE CONTEXT');
    expect(p).toContain('We are open Mon-Sat.');
  });

  it('contains the never-claim-human rule', () => {
    const p = buildSystemPrompt(agent, 'Biz', '');
    expect(p).toContain('Never claim to be a human');
  });
});
