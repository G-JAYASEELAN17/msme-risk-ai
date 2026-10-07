import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebase";
import { api, UserProfile } from "../services/api";

export type RoleType = "user" | "analyst" | "admin";

export interface AuthRoleContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: RoleType;
  isUser: boolean;
  isAnalyst: boolean;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthRoleContext = createContext<AuthRoleContextType | undefined>(undefined);

export function AuthRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  const fetchProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return;
    }
    try {
      setProfileLoading(true);
      const profile = await api.getUserProfile();
      setUserProfile(profile);
    } catch (err) {
      console.warn("Unable to fetch user profile, defaulting role to 'user':", err);
      // Fallback profile if backend isn't reachable immediately
      setUserProfile({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || "",
        name: auth.currentUser.displayName || "User",
        role: "user",
        settings: {},
        created_at: new Date().toISOString(),
      });
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile();
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const rawRole = (userProfile?.role || "user").toLowerCase();
  const role: RoleType = (rawRole === "admin" || rawRole === "analyst") ? rawRole : "user";
  const isUser = role === "user";
  const isAnalyst = role === "analyst" || role === "admin";
  const isAdmin = role === "admin";

  return (
    <AuthRoleContext.Provider
      value={{
        user,
        userProfile,
        role,
        isUser,
        isAnalyst,
        isAdmin,
        loading,
        profileLoading,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthRoleContext.Provider>
  );
}

export function useAuthRole(): AuthRoleContextType {
  const context = useContext(AuthRoleContext);
  if (!context) {
    throw new Error("useAuthRole must be used within an AuthRoleProvider");
  }
  return context;
}
