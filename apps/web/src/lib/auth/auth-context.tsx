'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { Role, hasAtLeastRole, canManageSystem, canPublish } from '@phuochai/shared';
import {
  MeDocument,
  useLoginMutation,
  useRegisterMutation,
  type MeQuery,
} from '@/generated/graphql';
import { clearAuth, getToken, setStoredUser, setToken } from './token';

export type AuthUser = NonNullable<MeQuery['me']>;

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  /** Đăng ký tài khoản mới: tài khoản chờ quản trị viên duyệt, KHÔNG đăng nhập ngay. */
  register: (name: string, email: string, password: string) => Promise<{ requiresApproval: boolean; message: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  canPublish: boolean;
  canManageSystem: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const apollo = useApolloClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const result = await apollo.query({ query: MeDocument, fetchPolicy: 'network-only' });
      const me = (result.data?.me ?? null) as AuthUser | null;
      setUser(me);
      setStoredUser(me);
      if (!me) clearAuth();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [apollo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation({ variables: { input: { email, password } } });
      const payload = result.data?.login;
      if (!payload) throw new Error('Đăng nhập thất bại');
      setToken(payload.accessToken);
      const me = payload.user as AuthUser;
      setUser(me);
      setStoredUser(me);
      return me;
    },
    [loginMutation],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await registerMutation({
        variables: { input: { name, email, password, confirmPassword: password } },
      });
      const payload = result.data?.register;
      if (!payload) throw new Error('Đăng ký thất bại');
      // Tài khoản mới ở trạng thái chờ duyệt -> không lưu token, không đăng nhập
      return { requiresApproval: payload.requiresApproval, message: payload.message };
    },
    [registerMutation],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    void apollo.clearStore();
  }, [apollo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refresh,
      hasRole: (role: Role) => hasAtLeastRole(user?.role as Role | undefined, role),
      canPublish: canPublish(user?.role as Role | undefined),
      canManageSystem: canManageSystem(user?.role as Role | undefined),
    }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return context;
}
