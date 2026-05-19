import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string | null, refreshToken?: string | null) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) =>
        set((state) => ({
          accessToken,
          refreshToken:
            refreshToken === undefined ? state.refreshToken : refreshToken,
        })),
      clearAuth: () => set({ accessToken: null, refreshToken: null }),
    }),
    { name: 'chesscast-auth' },
  ),
);
