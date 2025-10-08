import { create } from 'zustand';
import { SubscriptionType } from './pricing';

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  subscription: SubscriptionType;
  verified: boolean;
  createdAt: string;
  subscriptionEnd: string;
}

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
