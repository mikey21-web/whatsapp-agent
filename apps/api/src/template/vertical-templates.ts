import type { Vertical } from '@diyaa/db';
import type { FlowDoc } from '../flow/flow.types';

export interface AgentTemplate {
  name: string;
  persona: string;
  systemPrompt: string;
  language: string[];
  handoffKeywords: string[];
}

export interface PipelineTemplate {
  name: string;
  stages: { name: string; color: string }[];
}

export interface FlowTemplate {
  name: string;
  trigger: 'INBOUND_MESSAGE' | 'KEYWORD' | 'NEW_CONTACT';
  doc: FlowDoc;
}

export interface KbSeed {
  title: string;
  content: string;
}

export interface VerticalTemplate {
  vertical: Vertical;
  label: string;
  agent: AgentTemplate;
  pipeline: PipelineTemplate;
  flows: FlowTemplate[];
  knowledge: KbSeed[];
}

const t = (id: string) => id; // shorthand for stable node ids

export const VERTICAL_TEMPLATES: Record<Vertical, VerticalTemplate> = {
  REAL_ESTATE: {
    vertical: 'REAL_ESTATE',
    label: 'Real Estate',
    agent: {
      name: 'Priya',
      persona: 'friendly real estate consultant',
      systemPrompt:
        'Qualify property buyers by asking about budget, BHK preference, location, and timeline. Once qualified, offer to book a site visit and ask for the best time. Never quote final prices — defer to the team. Keep replies under 3 sentences.',
      language: ['en', 'hi', 'te'],
      handoffKeywords: ['human', 'agent', 'manager', 'site visit', 'price'],
    },
    pipeline: {
      name: 'Buyer Pipeline',
      stages: [
        { name: 'New Inquiry', color: '#94a3b8' },
        { name: 'Qualified', color: '#6366f1' },
        { name: 'Site Visit Scheduled', color: '#f59e0b' },
        { name: 'Negotiation', color: '#fb923c' },
        { name: 'Closed Won', color: '#16a34a' },
        { name: 'Closed Lost', color: '#dc2626' },
      ],
    },
    flows: [
      {
        name: 'Welcome new lead',
        trigger: 'NEW_CONTACT',
        doc: {
          nodes: [
            { id: t('trigger'), kind: 'TRIGGER', data: {} },
            {
              id: t('welcome'),
              kind: 'SEND_MESSAGE',
              data: {
                text: 'Hi {{ vars.name }}! Thanks for reaching out. I can help you find your next property. What budget range and area are you exploring?',
              },
            },
            { id: t('tag'), kind: 'ADD_TAG', data: { tag: 'new-lead' } },
            { id: t('end'), kind: 'END', data: {} },
          ],
          edges: [
            { id: 'e1', source: 'trigger', target: 'welcome' },
            { id: 'e2', source: 'welcome', target: 'tag' },
            { id: 'e3', source: 'tag', target: 'end' },
          ],
        },
      },
    ],
    knowledge: [
      {
        title: 'Common buyer questions',
        content:
          'We help buyers find apartments and plots across major Indian cities. Standard documentation includes Aadhaar, PAN, and proof of income. Site visits are scheduled Mon-Sat 10am-7pm. Home loan partners include HDFC, SBI, and ICICI.',
      },
    ],
  },

  CLINIC: {
    vertical: 'CLINIC',
    label: 'Clinic / Healthcare',
    agent: {
      name: 'Dr. Anu Bot',
      persona: 'helpful clinic assistant',
      systemPrompt:
        'Help patients book appointments and answer general questions about clinic hours, doctors, and services. Never give medical diagnoses — always recommend booking a consultation. Ask for symptoms only to route to the right department. Keep replies brief and reassuring.',
      language: ['en', 'hi'],
      handoffKeywords: ['emergency', 'urgent', 'human', 'reception'],
    },
    pipeline: {
      name: 'Patient Funnel',
      stages: [
        { name: 'Inquiry', color: '#94a3b8' },
        { name: 'Appointment Booked', color: '#6366f1' },
        { name: 'Visited', color: '#16a34a' },
        { name: 'Follow-up', color: '#f59e0b' },
        { name: 'Regular Patient', color: '#0ea5e9' },
      ],
    },
    flows: [
      {
        name: 'Emergency keyword handoff',
        trigger: 'KEYWORD',
        doc: {
          nodes: [
            { id: 'trigger', kind: 'TRIGGER', data: { keyword: 'emergency', match: 'contains' } },
            { id: 'reply', kind: 'SEND_MESSAGE', data: { text: 'Please call our emergency line immediately. A team member is also being notified.' } },
            { id: 'tag', kind: 'ADD_TAG', data: { tag: 'urgent' } },
            { id: 'end', kind: 'END', data: {} },
          ],
          edges: [
            { id: 'e1', source: 'trigger', target: 'reply' },
            { id: 'e2', source: 'reply', target: 'tag' },
            { id: 'e3', source: 'tag', target: 'end' },
          ],
        },
      },
    ],
    knowledge: [
      {
        title: 'Clinic info',
        content:
          'Clinic hours: Mon-Sat 9am-8pm, Sun 10am-2pm. We have specialists in general medicine, dermatology, pediatrics, and cardiology. Walk-ins accepted but appointments preferred. Insurance partners: Star, HDFC ERGO, Niva Bupa.',
      },
    ],
  },

  COACHING: {
    vertical: 'COACHING',
    label: 'Coaching / EdTech',
    agent: {
      name: 'Coach Bot',
      persona: 'enthusiastic education advisor',
      systemPrompt:
        'Explain courses, qualify learners by asking about their goals and current level, handle common objections, and book a free demo session. Never reveal pricing — direct learners to book a call. Keep responses encouraging and specific.',
      language: ['en', 'hi'],
      handoffKeywords: ['fees', 'price', 'human', 'counselor'],
    },
    pipeline: {
      name: 'Student Pipeline',
      stages: [
        { name: 'Lead', color: '#94a3b8' },
        { name: 'Demo Scheduled', color: '#6366f1' },
        { name: 'Demo Done', color: '#f59e0b' },
        { name: 'Enrolled', color: '#16a34a' },
        { name: 'Active Student', color: '#0ea5e9' },
      ],
    },
    flows: [],
    knowledge: [
      {
        title: 'Course catalog',
        content:
          'We offer live cohort-based programs in data science, full-stack development, and digital marketing. Programs run 12-16 weeks with 1:1 mentorship and placement support. All learners get a free 30-min consult.',
      },
    ],
  },

  D2C: {
    vertical: 'D2C',
    label: 'D2C / E-commerce',
    agent: {
      name: 'Shop Helper',
      persona: 'cheerful shopping assistant',
      systemPrompt:
        'Help shoppers find products, check order status, handle returns and exchanges. If a customer asks about pricing or availability, refer to the catalog in your knowledge base. For order issues, ask for the order number first.',
      language: ['en', 'hi'],
      handoffKeywords: ['refund', 'complaint', 'human', 'manager'],
    },
    pipeline: {
      name: 'Customer Journey',
      stages: [
        { name: 'Window Shopping', color: '#94a3b8' },
        { name: 'Cart', color: '#6366f1' },
        { name: 'Ordered', color: '#f59e0b' },
        { name: 'Delivered', color: '#16a34a' },
        { name: 'Repeat Buyer', color: '#0ea5e9' },
      ],
    },
    flows: [],
    knowledge: [],
  },

  HOSPITALITY: {
    vertical: 'HOSPITALITY',
    label: 'Hotel / Restaurant',
    agent: {
      name: 'Concierge',
      persona: 'warm hospitality concierge',
      systemPrompt:
        'Handle bookings, menu inquiries, and special requests. For room/table availability, share what is in the knowledge base, then offer to confirm with the team. For VIP requests, escalate.',
      language: ['en', 'hi'],
      handoffKeywords: ['complaint', 'manager', 'human', 'cancel'],
    },
    pipeline: {
      name: 'Booking Pipeline',
      stages: [
        { name: 'Inquiry', color: '#94a3b8' },
        { name: 'Quote Sent', color: '#6366f1' },
        { name: 'Confirmed', color: '#f59e0b' },
        { name: 'Checked In', color: '#16a34a' },
        { name: 'Post-Stay Follow-up', color: '#0ea5e9' },
      ],
    },
    flows: [],
    knowledge: [],
  },

  EDUCATION: {
    vertical: 'EDUCATION',
    label: 'Schools / Colleges',
    agent: {
      name: 'Admission Bot',
      persona: 'professional admissions assistant',
      systemPrompt:
        'Help prospective students and parents understand programs, eligibility, and the admission process. Collect lead details (student name, program of interest, intake year) and route to a counsellor.',
      language: ['en', 'hi'],
      handoffKeywords: ['fees', 'counselor', 'human', 'application'],
    },
    pipeline: {
      name: 'Admissions Funnel',
      stages: [
        { name: 'Inquiry', color: '#94a3b8' },
        { name: 'Counsellor Call', color: '#6366f1' },
        { name: 'Application Started', color: '#f59e0b' },
        { name: 'Admitted', color: '#16a34a' },
      ],
    },
    flows: [],
    knowledge: [],
  },

  FINANCE: {
    vertical: 'FINANCE',
    label: 'Finance / Insurance',
    agent: {
      name: 'Finance Bot',
      persona: 'compliant financial advisor assistant',
      systemPrompt:
        'Educate prospects about products in the knowledge base. Never give specific investment or insurance advice. Always end with: "A licensed advisor will get in touch shortly." Capture the prospect\'s goals, age, and contact preference.',
      language: ['en', 'hi'],
      handoffKeywords: ['advisor', 'human', 'claim', 'policy'],
    },
    pipeline: {
      name: 'Lead Funnel',
      stages: [
        { name: 'Cold Lead', color: '#94a3b8' },
        { name: 'Discovery Call', color: '#6366f1' },
        { name: 'Proposal Sent', color: '#f59e0b' },
        { name: 'Closed Won', color: '#16a34a' },
        { name: 'Closed Lost', color: '#dc2626' },
      ],
    },
    flows: [],
    knowledge: [],
  },

  GENERAL: {
    vertical: 'GENERAL',
    label: 'General Business',
    agent: {
      name: 'Support Bot',
      persona: 'helpful customer service assistant',
      systemPrompt:
        'Greet customers, understand their request, answer using the knowledge base, and route complex queries to the team. Be friendly and concise.',
      language: ['en', 'hi'],
      handoffKeywords: ['human', 'manager'],
    },
    pipeline: {
      name: 'Sales Pipeline',
      stages: [
        { name: 'Lead', color: '#94a3b8' },
        { name: 'Qualified', color: '#6366f1' },
        { name: 'Proposal', color: '#f59e0b' },
        { name: 'Closed Won', color: '#16a34a' },
        { name: 'Closed Lost', color: '#dc2626' },
      ],
    },
    flows: [],
    knowledge: [],
  },
};
