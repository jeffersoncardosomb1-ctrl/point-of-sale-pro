import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "seller";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  firstName: string | null;
  lastName: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    isLoading: true,
    isAdmin: false,
    isApproved: false,
    firstName: null,
    lastName: null,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserStatus(session.user.id);
          }, 0);
        } else {
          setAuthState((prev) => ({
            ...prev,
            role: null,
            isAdmin: false,
            isApproved: false,
            firstName: null,
            lastName: null,
            isLoading: false,
          }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        fetchUserStatus(session.user.id);
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserStatus = async (userId: string) => {
    try {
      // Fetch profile to check if approved (is_active) and get name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const isApproved = profile?.is_active === true;
      const firstName = profile?.first_name ?? null;
      const lastName = profile?.last_name ?? null;

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) {
        console.error("Error fetching user role:", roleError);
      }

      const role = (roleData?.role as AppRole) ?? null;
      setAuthState((prev) => ({
        ...prev,
        role,
        isAdmin: role === "admin",
        isApproved,
        firstName,
        lastName,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error fetching user status:", error);
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  };
}
