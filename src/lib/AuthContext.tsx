import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  getSupabaseConfigDiagnostics,
  type SupabaseConfigDiagnostics,
  type SupabaseProfileDiagnostics,
  signInWithSupabase,
  signUpWithSupabase,
  signOutSupabase,
  getSupabaseProfileDetailed,
  ensureClientProfileStrict,
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
  diagnostics: SupabaseProfileDiagnostics | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserAccount | null;
  profileStatus: ProfileLoadStatus;
  profileError: string | null;
  profileDiagnostics: SupabaseProfileDiagnostics | null;
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
    profileDiagnostics?: SupabaseProfileDiagnostics | null;
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
    reference?: string;
  }) => Promise<{
    error: Error | null;
    user?: User | null;
    session?: Session | null;
    requiresEmailConfirmation?: boolean;
    profile?: UserAccount | null;
    profileStatus?: ProfileLoadStatus;
    profileError?: string | null;
    profileDiagnostics?: SupabaseProfileDiagnostics | null;
  }>;
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
  const [profileDiagnostics, setProfileDiagnostics] = useState<SupabaseProfileDiagnostics | null>(null);

  const authEpochRef = useRef(0);
  const inFlightSyncRef = useRef<{
    userId: string;
    epoch: number;
    promise: Promise<SyncProfileOutcome>;
  } | null>(null);
  const currentUserRef = useRef<UserAccount | null>(store.currentUser);
  currentUserRef.current = store.currentUser;

  // Authoritative profile synchronization from public.profiles via auth.uid().
  // Never fabricates or downgrades an account to CUSTOMER on transient error or missing row.
  const syncProfile = async (
    currentUser: User,
    options?: {
      forceRefresh?: boolean;
      ensureIfMissingClient?: boolean;
      overrideMeta?: {
        fullName?: string;
        phone?: string;
        province?: string;
        municipio?: string;
        bairro?: string;
        address?: string;
        reference?: string;
      };
    }
  ): Promise<SyncProfileOutcome> => {
    if (!currentUser?.id) {
      setProfileStatus("error");
      setProfileError("Sessão sem identificador de utilizador válido.");
      return {
        profile: null,
        status: "error",
        error: "Sessão sem identificador de utilizador válido.",
        diagnostics: null,
      };
    }

    const syncEpoch = authEpochRef.current;

    if (
      !options?.forceRefresh &&
      inFlightSyncRef.current?.userId === currentUser.id &&
      inFlightSyncRef.current?.epoch === syncEpoch
    ) {
      return inFlightSyncRef.current.promise;
    }

    const runSync = (async (): Promise<SyncProfileOutcome> => {
      // Avoid flashing loading spinner over an already-verified portal on background refresh
      if (currentUserRef.current?.id !== currentUser.id || options?.forceRefresh) {
        setProfileStatus("loading");
      }
      setProfileError(null);

      let result = await getSupabaseProfileDetailed(currentUser.id);
      // One short retry to guard against initial post-login token commit timing
      if (!result.ok && syncEpoch === authEpochRef.current) {
        await new Promise((r) => setTimeout(r, 150));
        if (syncEpoch === authEpochRef.current) {
          result = await getSupabaseProfileDetailed(currentUser.id);
        }
      }

      if (syncEpoch !== authEpochRef.current) {
        return {
          profile: currentUserRef.current,
          status: currentUserRef.current ? "ready" : "idle",
          error: null,
          diagnostics: result.diagnostics,
        };
      }

      // If row is genuinely missing (ok === true, profile === null) for a registered client
      // (e.g. signup / first login after email confirmation when trigger hadn't run yet),
      // safely create/upsert the client profile via auth.uid() and re-verify.
      const normalizedEmail = (currentUser.email || "").trim().toLowerCase();
      const metaRole = String(currentUser.user_metadata?.role || "").trim().toLowerCase();
      const shouldRecoverClientProfile =
        result.ok &&
        !result.profile &&
        normalizedEmail !== "admin@resolvemcx.ao" &&
        (options?.ensureIfMissingClient || !metaRole || metaRole === "cliente");

      if (shouldRecoverClientProfile) {
        result = await ensureClientProfileStrict(currentUser, options?.overrideMeta);
        if (syncEpoch !== authEpochRef.current) {
          return {
            profile: currentUserRef.current,
            status: currentUserRef.current ? "ready" : "idle",
            error: null,
            diagnostics: result.diagnostics,
          };
        }
      }

      setProfileDiagnostics(result.diagnostics);

      if (!result.ok) {
        const errMsg =
          result.error || "Não foi possível carregar o perfil em public.profiles.";
        const existingVerified = currentUserRef.current;
        if (existingVerified && existingVerified.id === currentUser.id) {
          // Preserve verified profile (e.g. SUPER_ADMIN) during transient background refresh errors
          setProfileStatus("ready");
          setProfileError(null);
          return {
            profile: existingVerified,
            status: "ready",
            error: null,
            diagnostics: result.diagnostics,
          };
        }
        setStore(() => ({ currentUser: null }));
        setProfileStatus("error");
        setProfileError(errMsg);
        return {
          profile: null,
          status: "error",
          error: errMsg,
          diagnostics: result.diagnostics,
        };
      }

      if (!result.profile) {
        const missingMsg =
          result.error ||
          "Esta conta foi autenticada, mas não existe um registo válido na tabela public.profiles.";
        setStore(() => ({ currentUser: null }));
        setProfileStatus("missing");
        setProfileError(missingMsg);
        return {
          profile: null,
          status: "missing",
          error: missingMsg,
          diagnostics: result.diagnostics,
        };
      }

      const mappedRole = mapDbRoleToUserRoleStrict(result.profile.role);
      if (!mappedRole) {
        const invalidRoleMsg = `O perfil na base de dados possui um papel não reconhecido ('${String(
          result.profile.role || ""
        )}').`;
        setStore(() => ({ currentUser: null }));
        setProfileStatus("error");
        setProfileError(invalidRoleMsg);
        return {
          profile: null,
          status: "error",
          error: invalidRoleMsg,
          diagnostics: result.diagnostics,
        };
      }

      const account: UserAccount = {
        id: result.profile.id,
        name:
          result.profile.full_name ||
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split("@")[0] ||
          "Utilizador",
        email: result.profile.email || currentUser.email || "",
        phone: result.profile.phone || currentUser.user_metadata?.phone || "",
        role: mappedRole,
        province: result.profile.province || currentUser.user_metadata?.province || "Huambo",
        municipio: result.profile.municipio || currentUser.user_metadata?.municipio || "Huambo",
        bairro: result.profile.bairro || currentUser.user_metadata?.bairro || undefined,
        address: result.profile.address || currentUser.user_metadata?.address || undefined,
        reference: result.profile.reference || currentUser.user_metadata?.reference || undefined,
        avatar: result.profile.avatar_url || undefined,
        active: true,
      };

      setStore(() => ({ currentUser: account }));
      setProfileStatus("ready");
      setProfileError(null);
      return {
        profile: account,
        status: "ready",
        error: null,
        diagnostics: result.diagnostics,
      };
    })();

    inFlightSyncRef.current = { userId: currentUser.id, epoch: syncEpoch, promise: runSync };
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

    const mountEpoch = authEpochRef.current;

    // 1. Initial Session Check
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!mounted || mountEpoch !== authEpochRef.current) return;
        if (error) {
          console.warn("Supabase getSession warning:", error.message);
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await syncProfile(initialSession.user);
          if (!mounted || mountEpoch !== authEpochRef.current) return;
          refreshPlatformAssetsSnapshot();
          refreshPlatformSettingsSnapshot();
        } else {
          setStore(() => ({ currentUser: null }));
          setProfileStatus("idle");
          setProfileError(null);
          setProfileDiagnostics(null);
        }

        if (mounted && mountEpoch === authEpochRef.current) {
          setLoading(false);
        }
      });

    // 2. Real-time auth state listener (deferred out of auth lock via setTimeout 0)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        authEpochRef.current += 1;
        inFlightSyncRef.current = null;
        setSession(null);
        setUser(null);
        setStore(() => ({ currentUser: null }));
        setProfileStatus("idle");
        setProfileError(null);
        setProfileDiagnostics(null);
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
        if (event === "SIGNED_IN") {
          authEpochRef.current += 1;
        }
        const callbackEpoch = authEpochRef.current;
        const targetUser = currentSession.user;
        setSession(currentSession);
        setUser(targetUser);
        setTimeout(async () => {
          if (!mounted || callbackEpoch !== authEpochRef.current) return;
          await syncProfile(targetUser);
          if (!mounted || callbackEpoch !== authEpochRef.current) return;
          if (event === "SIGNED_IN") {
            refreshPlatformAssetsSnapshot();
            refreshPlatformSettingsSnapshot();
          }
          if (mounted) setLoading(false);
        }, 0);
      } else {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    authEpochRef.current += 1;
    setLoading(true);
    setProfileStatus("loading");
    setProfileError(null);
    setProfileDiagnostics(null);
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
          profileDiagnostics: null,
        };
      }

      // Ensure the Supabase client session is committed before querying public.profiles
      const { data: activeSessData } = await supabase.auth.getSession();
      if (!activeSessData?.session?.access_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      setUser(data.user);
      setSession(data.session);
      const outcome = await syncProfile(data.user, { forceRefresh: true });
      refreshPlatformAssetsSnapshot();
      refreshPlatformSettingsSnapshot();

      return {
        error: null,
        user: data.user,
        session: data.session,
        profile: outcome.profile,
        profileError: outcome.error,
        profileDiagnostics: outcome.diagnostics,
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
    reference?: string;
  }) => {
    authEpochRef.current += 1;
    setLoading(true);
    setProfileError(null);
    setProfileDiagnostics(null);
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
        address: params.address,
        reference: params.reference,
      });

      if (error) {
        setProfileStatus("idle");
        return {
          error,
          user: data?.user ?? null,
          session: null,
          profile: null,
        };
      }

      // Detect Supabase obfuscated response for already-registered email (identities: [])
      if (
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setProfileStatus("idle");
        return {
          error: new Error(
            "Este endereço de email já se encontra registado. Inicie sessão na aba 'Iniciar Sessão'."
          ),
          user: null,
          session: null,
          profile: null,
        };
      }

      if (!data?.user) {
        setProfileStatus("idle");
        return {
          error: new Error("O Supabase Auth não criou o registo do utilizador."),
          user: null,
          session: null,
          profile: null,
        };
      }

      // Email confirmation required (user created in auth.users, session intentionally null until verified)
      if (!data.session) {
        setProfileStatus("idle");
        return {
          error: null,
          user: data.user,
          session: null,
          requiresEmailConfirmation: true,
          profile: null,
          profileStatus: "idle" as ProfileLoadStatus,
        };
      }

      // Ensure session is committed before querying/inserting into public.profiles
      const { data: activeSessData } = await supabase.auth.getSession();
      if (!activeSessData?.session?.access_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      setUser(data.user);
      setSession(data.session);

      const outcome = await syncProfile(data.user, {
        forceRefresh: true,
        ensureIfMissingClient: true,
        overrideMeta: {
          fullName: params.fullName,
          phone: params.phone,
          province: params.province,
          municipio: params.municipio,
          bairro: params.bairro,
          address: params.address,
          reference: params.reference,
        },
      });

      if (outcome.status !== "ready" || !outcome.profile) {
        return {
          error: new Error(
            outcome.error ||
              "A conta foi criada no Auth, mas o perfil não foi confirmado na tabela public.profiles."
          ),
          user: data.user,
          session: data.session,
          requiresEmailConfirmation: false,
          profile: null,
          profileStatus: outcome.status,
          profileError: outcome.error,
          profileDiagnostics: outcome.diagnostics,
        };
      }

      refreshPlatformAssetsSnapshot();
      refreshPlatformSettingsSnapshot();

      return {
        error: null,
        user: data.user,
        session: data.session,
        requiresEmailConfirmation: false,
        profile: outcome.profile,
        profileStatus: outcome.status,
        profileError: null,
        profileDiagnostics: outcome.diagnostics,
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    authEpochRef.current += 1;
    inFlightSyncRef.current = null;
    setLoading(true);
    setSession(null);
    setUser(null);
    setStore(() => ({ currentUser: null }));
    setProfileStatus("idle");
    setProfileError(null);
    setProfileDiagnostics(null);
    try {
      await signOutSupabase();
    } finally {
      setSession(null);
      setUser(null);
      setStore(() => ({ currentUser: null }));
      setLoading(false);
    }
  };

  const refreshProfile = async (): Promise<SyncProfileOutcome | null> => {
    if (!user) return null;
    return await syncProfile(user, { forceRefresh: true });
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
      profileDiagnostics,
      loading,
      isConfigured: configDiagnostics.configured,
      configDiagnostics,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
    }),
    [session, user, store.currentUser, profileStatus, profileError, profileDiagnostics, loading]
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
