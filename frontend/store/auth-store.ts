import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthState = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null }),
    }),
    { name: 'chesscast-auth' },
  ),
);
