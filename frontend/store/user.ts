import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionType } from './pricing';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  subscription?: SubscriptionType;
  verified?: boolean;
  createdAt?: string;
  subscriptionEnd?: string;
  platformRole?: 'USER' | 'SUPERADMIN';
}

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'chesscast-user',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
