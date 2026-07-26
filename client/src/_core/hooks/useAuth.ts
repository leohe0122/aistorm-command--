import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  // Primary: Manus OAuth session
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fallback: internal email session
  const emailMeQuery = trpc.emailAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // Prefer Manus OAuth user; fall back to email user
    const emailData = emailMeQuery.data;
    const user = meQuery.data ?? (emailData ? {
      id: emailData.id,
      openId: `email_${emailData.id}`,
      name: emailData.name,
      email: emailData.email,
      role: (emailData.role ?? 'user') as 'admin' | 'user',
      loginMethod: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null);

    localStorage.setItem("manus-runtime-user-info", JSON.stringify(user));

    const isLoading = (meQuery.isLoading && emailMeQuery.isLoading) || logoutMutation.isPending;

    return {
      user,
      loading: isLoading,
      error: user == null ? (meQuery.error ?? logoutMutation.error ?? null) : null,
      isAuthenticated: Boolean(user),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    emailMeQuery.data,
    emailMeQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if ((meQuery.isLoading && emailMeQuery.isLoading) || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    emailMeQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => { meQuery.refetch(); emailMeQuery.refetch(); },
    logout,
  };
}
