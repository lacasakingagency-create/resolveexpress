import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  getSupabaseConfigDiagnostics,
  type SupabaseConfigDiagnostics,
  signInWithSupabase,
  signUpWithSupabase,
  signOutSupabase,
  getSupabaseProfileDetailed,
  mapDbRoleToUserRoleStrict,
} from "./supabase";
import { useStore, type UserAccount, type UserRole } from "./store";
import {
  refreshPlatformAssetsSnapshot,
  refreshPlatformSettingsSnapshot,
} from "./supabase/realtime";

export type ProfileLoadStatus = "idle" | "loading" | "ready" | "missing" | "error";

export function getDashboardRouteForRole(role?: UserRole | null): string | null {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin";
    case "OPERATIONS":
      return "/operacao";
    case "CUSTOMER_SUPPORT":
      return "/apoio";
    case "EMPLOYEE":
      return "/portal-funcionario";
    case "BUSINESS_PARTNER":
    case "PARTNER":
      return "/portal-empresa";
    case "PROFESSIONAL":
      return "/portal-parceiro";
    case "SELLER":
      return "/praca/painel-vendedor";
    case "AFFILIATE":
      return "/praca/painel-afiliado";
    case "CUSTOMER":
      return "/portal-cliente";
    default:
      return null;
  }
}

interface SyncProfileOutcome {
  profile: UserAccount | null;
  status: ProfileLoadStatus;
  error: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserAccount | null;
  profileStatus: ProfileLoadStatus;
  profileError: string | null;
  loading: boolean;
  isConfigured: boolean;
  configDiagnostics: SupabaseConfigDiagnostics;
  signIn: (
    email: string,
    pass: string
  ) => Promise<{
    error: Error | null;
    user?: User | null;
    session?: Session | null;
    profile?: UserAccount | null;
    profileError?: string | null;
  }>;
  signUp: (params: {
    email: string;
    pass: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    province?: string;
    municipio?: string;
    bairro?: string;
    address?: string;
  }) => Promise<{ error: Error | null; user?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<SyncProfileOutcome | null>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const inFlightSyncRef = useRef<{
    userId: string;
    promise: Promise<SyncProfileOutcome>;
  } | null>(null);
  const currentUserRef = useRef<UserAccount | null>(store.currentUser);
  currentUserRef.current = store.currentUser;

  // Authoritative profile synchronization from public.profiles via auth.uid().
  // Never fabricates or downgrades an account to CUSTOMER on transient error or missing row.
  const syncProfile = async (currentUser: User): Promise<SyncProfileOutcome> => {
    if (!currentUser?.id) {
      setProfileStatus("error");
      setProfileError("Sessão sem identificador de utilizador válido.");
      return {
        profile: null,
        status: "error",
        error: "Sessão sem identificador de utilizador válido.",
      };
    }

    if (inFlightSyncRef.current?.userId === currentUser.id) {
      return inFlightSyncRef.current.promise;
    }

    const runSync = (async (): Promise<SyncProfileOutcome> => {
      setProfileStatus("loading");
      setProfileError(null);

      let result = await getSupabaseProfileDetailed(currentUser.id);
      // One short retry to guard against initial post-login token commit timing
      if (!result.ok) {
        await new Promise((r) => setTimeout(r, 150));
        result = await getSupabaseProfileDetailed(currentUser.id);
      }

      if (!result.ok) {
        const errMsg =
          result.error || "Não foi possível carregar o perfil em public.profiles.";
        const existingVerified = currentUserRef.current;
        if (existingVerified && existingVerified.id === currentUser.id) {
          // Preserve verified profile (e.g. SUPER_ADMIN) during transient background refresh errors
          setProfileStatus("ready");
          setProfileError(null);
          return { profile: existingVerified, status: "ready", error: null };
        }
        setStore(() => ({ currentUser: null }));
        setProfileStatus("error");
        setProfileError(errMsg);
        return { profile: null, status: "error", error: errMsg };
      }

      if (!result.profile) {
        const missingMsg =
          "Esta conta foi autenticada, mas não existe um registo válido na tabela public.profiles.";
        setStore(() => ({ currentUser: null }));
        setProfileStatus("missing");
        setProfileError(missingMsg);
        return { profile: null, status: "missing", error: missingMsg };
      }

      const mappedRole = mapDbRoleToUserRoleStrict(result.profile.role);
      if (!mappedRole) {
        const invalidRoleMsg = `O perfil na base de dados possui um papel não reconhecido ('${String(
          result.profile.role || ""
        )}').`;
        setStore(() => ({ currentUser: null }));
        setProfileStatus("error");
        setProfileError(invalidRoleMsg);
        return { profile: null, status: "error", error: invalidRoleMsg };
      }

      const account: UserAccount = {
        id: result.profile.id,
        name:
          result.profile.full_name ||
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split("@")[0] ||
          "Utilizador",
        email: result.profile.email || currentUser.email || "",
        phone: result.profile.phone || "",
        role: mappedRole,
        province: result.profile.province || "Huambo",
        municipio: result.profile.municipio || "Huambo",
        bairro: result.profile.bairro || undefined,
        avatar: result.profile.avatar_url || undefined,
        active: true,
      };

      setStore(() => ({ currentUser: account }));
      setProfileStatus("ready");
      setProfileError(null);
      return { profile: account, status: "ready", error: null };
    })();

    inFlightSyncRef.current = { userId: currentUser.id, promise: runSync };
    try {
      return await runSync;
    } finally {
      if (inFlightSyncRef.current?.promise === runSync) {
        inFlightSyncRef.current = null;
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const diag = getSupabaseConfigDiagnostics();

    if (!diag.configured) {
      setLoading(false);
      return;
    }

    // 1. Initial Session Check
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!mounted) return;
        if (error) {
          console.warn("Supabase getSession warning:", error.message);
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await syncProfile(initialSession.user);
          refreshPlatformAssetsSnapshot();
          refreshPlatformSettingsSnapshot();
        } else {
          setStore(() => ({ currentUser: null }));
          setProfileStatus("idle");
          setProfileError(null);
        }

        if (mounted) {
          setLoading(false);
        }
      });

    // 2. Real-time auth state listener (deferred out of auth lock via setTimeout 0)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === "SIGNED_OUT") {
        setStore(() => ({ currentUser: null }));
        setProfileStatus("idle");
        setProfileError(null);
        setLoading(false);
        setTimeout(() => {
          refreshPlatformAssetsSnapshot();
        }, 0);
        return;
      }

      if (
        currentSession?.user &&
        (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED")
      ) {
        const targetUser = currentSession.user;
        setTimeout(async () => {
          if (!mounted) return;
          await syncProfile(targetUser);
          if (event === "SIGNED_IN") {
            refreshPlatformAssetsSnapshot();
            refreshPlatformSettingsSnapshot();
          }
          if (mounted) setLoading(false);
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    setProfileStatus("loading");
    setProfileError(null);
    try {
      const { data, error } = await signInWithSupabase(email, pass);
      if (error || !data?.user || !data?.session) {
        setProfileStatus("idle");
        return {
          error: error || new Error("Sessão não criada pelo Supabase Auth."),
          user: data?.user ?? null,
          session: data?.session ?? null,
          profile: null,
          profileError: null,
        };
      }

      setUser(data.user);
      setSession(data.session);
      const outcome = await syncProfile(data.user);
      refreshPlatformAssetsSnapshot();
      refreshPlatformSettingsSnapshot();

      return {
        error: null,
        user: data.user,
        session: data.session,
        profile: outcome.profile,
        profileError: outcome.error,
      };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (params: {
    email: string;
    pass: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    province?: string;
    municipio?: string;
    bairro?: string;
    address?: string;
  }) => {
    setLoading(true);
    try {
      // Security: Public self-registration is strictly 'cliente'. Administrative roles require database elevation.
      const dbRole = "cliente";
      const { data, error } = await signUpWithSupabase({
        email: params.email,
        pass: params.pass,
        fullName: params.fullName,
        phone: params.phone,
        role: dbRole,
        province: params.province,
        municipio: params.municipio,
        bairro: params.bairro,
      });

      if (!error && data?.user && data?.session) {
        setUser(data.user);
        setSession(data.session);
        await syncProfile(data.user);
      }
      return { error, user: data?.user };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await signOutSupabase();
      setSession(null);
      setUser(null);
      setStore(() => ({ currentUser: null }));
      setProfileStatus("idle");
      setProfileError(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async (): Promise<SyncProfileOutcome | null> => {
    if (!user) return null;
    return await syncProfile(user);
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!store.currentUser) return false;
    return allowedRoles.includes(store.currentUser.role);
  };

  const configDiagnostics = getSupabaseConfigDiagnostics();

  const value = useMemo(
    () => ({
      session,
      user,
      profile: store.currentUser,
      profileStatus,
      profileError,
      loading,
      isConfigured: configDiagnostics.configured,
      configDiagnostics,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
    }),
    [session, user, store.currentUser, profileStatus, profileError, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
