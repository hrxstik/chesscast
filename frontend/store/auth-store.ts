import { create } from 'zustand';
import {
  loginRequest,
  logoutRequest,
  registerRequest,
  type LoginBody,
  type RegisterBody,
} from '@/lib/api/auth';
import { getCurrentUser, type MeResponse } from '@/lib/api/user';
import { ApiError } from '@/lib/api/types';

export type AuthUser = MeResponse;

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  clearError: () => void;
};

let hydratePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true }),

  clearError: () => set({ error: null }),

  login: async (body) => {
    set({ isLoading: true, error: null });
    try {
      const data = await loginRequest(body);
      set({
        user: data.user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось войти в аккаунт';
      set({ error: msg, isLoading: false });
      throw e;
    }
  },

  register: async (body) => {
    set({ isLoading: true, error: null });
    try {
      const data = await registerRequest(body);
      set({
        user: data.user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось создать аккаунт';
      set({ error: msg, isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      /* сеть могла упасть — cookies всё равно чистим на клиенте через редирект */
    }
    set({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      error: null,
    });
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const me = await getCurrentUser();
        set({
          user: me,
          isAuthenticated: true,
          isHydrated: true,
          error: null,
        });
      } catch {
        set({
          user: null,
          isAuthenticated: false,
          isHydrated: true,
        });
      }
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },
}));
