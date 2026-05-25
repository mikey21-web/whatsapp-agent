'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Principal } from '@diyaa/types';

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  principal: Principal | null;
  setAuth: (a: { accessToken: string; expiresIn: number; principal: Principal }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      expiresAt: null,
      principal: null,
      setAuth: ({ accessToken, expiresIn, principal }) =>
        set({ accessToken, principal, expiresAt: Date.now() + expiresIn * 1000 }),
      clear: () => set({ accessToken: null, expiresAt: null, principal: null }),
    }),
    { name: 'diyaa-auth' },
  ),
);
