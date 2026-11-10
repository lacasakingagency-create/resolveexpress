import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  isSupabaseConfigured,
  signInWithSupabase,
  signUpWithSupabase,
  signOutSupabase,
  getSupabaseProfile,
  mapDbRoleToUserRole,
  mapUserRoleToDbRole,
} from "./supabase";
import { useStore, type UserAccount, type UserRole } from "./store";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserAccount | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null; user?: any }>;
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
  refreshProfile: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync profile from Supabase profiles table into store.currentUser
  const syncProfile = async (currentUser: User) => {
    try {
      const dbProfile = await getSupabaseProfile(currentUser.id);
      if (dbProfile) {
        const mappedRole = mapDbRoleToUserRole(dbProfile.role || "cliente");
        const account: UserAccount = {
          id: dbProfile.id,
          name: dbProfile.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Utilizador",
          email: dbProfile.email || currentUser.email || "",
          phone: dbProfile.phone || "",
          role: mappedRole,
          province: dbProfile.province || "Huambo",
          municipio: dbProfile.municipio || "Huambo",
          bairro: dbProfile.bairro || undefined,
          avatar: dbProfile.avatar_url || undefined,
          active: true,
        };
        setStore(() => ({ currentUser: account }));
        return;
      }
    } catch (e) {
      console.warn("Could not sync profile from Supabase:", e);
    }

    // Fallback: use user metadata
    if (currentUser) {
      const meta = currentUser.user_metadata || {};
      const fallbackRole = mapDbRoleToUserRole(meta.role || "cliente");
      const account: UserAccount = {
        id: currentUser.id,
        name: meta.full_name || meta.name || currentUser.email?.split("@")[0] || "Utilizador",
        email: currentUser.email || "",
        phone: meta.phone || "",
        role: fallbackRole,
        province: meta.province || "Huambo",
        municipio: meta.municipio || "Huambo",
        bairro: meta.bairro || undefined,
        active: true,
      };
      setStore(() => ({ currentUser: account }));
    }
  };

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn("Supabase getSession warning:", error.message);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        syncProfile(initialSession.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === "SIGNED_IN" && currentSession?.user) {
        await syncProfile(currentSession.user);
      } else if (event === "SIGNED_OUT") {
        setStore(() => ({ currentUser: null }));
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    const { data, error } = await signInWithSupabase(email, pass);
    if (!error && data?.user) {
      setUser(data.user);
      setSession(data.session);
      await syncProfile(data.user);
    }
    setLoading(false);
    return { error, user: data?.user };
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
    const dbRole = params.role ? mapUserRoleToDbRole(params.role) : "cliente";
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

    if (!error && data?.user) {
      setUser(data.user);
      setSession(data.session);
      await syncProfile(data.user);
    }
    setLoading(false);
    return { error, user: data?.user };
  };

  const signOut = async () => {
    setLoading(true);
    await signOutSupabase();
    setSession(null);
    setUser(null);
    setStore(() => ({ currentUser: null }));
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await syncProfile(user);
    }
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!store.currentUser) return false;
    return allowedRoles.includes(store.currentUser.role);
  };

  const value = useMemo(
    () => ({
      session,
      user,
      profile: store.currentUser,
      loading,
      isConfigured: isSupabaseConfigured(),
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
    }),
    [session, user, store.currentUser, loading]
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
