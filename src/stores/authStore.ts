import { create } from 'zustand';
import api from '../api/axios';
import { User, Role } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ requires2FA?: boolean; userId?: string }>;
  verify2FA: (userId: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  register: (data: { 
    name: string; 
    email: string; 
    password: string; 
    phone: string; 
    address: string;
    cep?: string;
    number?: string;
    complement?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const getAuthChecked = () => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('authChecked') === 'true';
};

const setAuthChecked = (value: boolean) => {
  sessionStorage.setItem('authChecked', value ? 'true' : 'false');
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    const state = get();
    if (state.user !== null || !state.isLoading) return;
    if (getAuthChecked()) {
      set({ isLoading: false });
      return;
    }
    setAuthChecked(true);
    
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ error: null, isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.requires2FA) {
        set({ isLoading: false });
        return { requires2FA: true, userId: response.data.userId };
      }

      set({ user: response.data.user, isLoading: false });
      return {};
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Erro ao fazer login', 
        isLoading: false 
      });
      throw error;
    }
  },

  verify2FA: async (userId: string, code: string) => {
    set({ error: null, isLoading: true });
    try {
      const response = await api.post('/auth/verify-2fa', { userId, code });
      set({ user: response.data.user, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Código inválido', 
        isLoading: false 
      });
      throw error;
    }
  },

  forgotPassword: async (email: string) => {
    set({ error: null, isLoading: true });
    try {
      const response = await api.post('/auth/forgot-password', { email });
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Erro ao processar solicitação', 
        isLoading: false 
      });
      throw error;
    }
  },

  resetPassword: async (token: string, newPassword: string) => {
    set({ error: null, isLoading: true });
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Erro ao resetar senha', 
        isLoading: false 
      });
      throw error;
    }
  },

  register: async (data) => {
    set({ error: null, isLoading: true });
    try {
      const response = await api.post('/auth/register', data);
      set({ user: response.data.user, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Erro ao fazer cadastro', 
        isLoading: false 
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));

export const hasRole = (user: User | null, roles: Role[]) => {
  return user ? roles.includes(user.role) : false;
};