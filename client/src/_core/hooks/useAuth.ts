import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
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
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
      await utils.auth.me.invalidate();
    },
    [loginMutation, utils]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      await registerMutation.mutateAsync({ email, password, name });
      await utils.auth.me.invalidate();
    },
    [registerMutation, utils]
  );

  return useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      login,
      register,
      logout,
      refresh: () => meQuery.refetch(),
      isLoggingIn: loginMutation.isPending,
      isRegistering: registerMutation.isPending,
      loginError: loginMutation.error,
      registerError: registerMutation.error,
    }),
    [
      meQuery.data,
      meQuery.error,
      meQuery.isLoading,
      meQuery.refetch,
      login,
      register,
      logout,
      loginMutation.isPending,
      loginMutation.error,
      registerMutation.isPending,
      registerMutation.error,
    ]
  );
}
