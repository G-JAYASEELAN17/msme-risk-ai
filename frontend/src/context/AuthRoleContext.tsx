import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebase";
import { api, UserProfile, invalidateUserProfileCache, invalidateBusinessesCache } from "../services/api";
import { clearSidebarCache } from "../components/Sidebar";

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

// In-memory module cache for authenticated user profile & promise deduplication
let cachedUserProfile: UserProfile | null = null;
let cachedUserUid: string | null = null;
let inFlightProfilePromise: Promise<UserProfile | null> | null = null;

export function clearAuthProfileCache() {
  cachedUserProfile = null;
  cachedUserUid = null;
  inFlightProfilePromise = null;
  invalidateUserProfileCache();
  invalidateBusinessesCache();
  clearSidebarCache();
}

export function AuthRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (auth.currentUser && cachedUserUid === auth.currentUser.uid) {
      return cachedUserProfile;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !auth.currentUser && !cachedUserProfile);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  const fetchProfile = useCallback(async (forceRefresh = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      cachedUserProfile = null;
      cachedUserUid = null;
      setUserProfile(null);
      return;
    }

    // Return cached profile if valid for this user
    if (!forceRefresh && cachedUserProfile && cachedUserUid === currentUser.uid) {
      setUserProfile(cachedUserProfile);
      return;
    }

    // Reuse existing in-flight request to prevent waterfalls/stampedes
    if (!forceRefresh && inFlightProfilePromise) {
      try {
        const profile = await inFlightProfilePromise;
        if (profile) setUserProfile(profile);
      } catch {
        // Handled in existing promise
      }
      return;
    }

    try {
      setProfileLoading(true);
      inFlightProfilePromise = (async () => {
        try {
          const profile = await api.getUserProfile();
          cachedUserProfile = profile;
          cachedUserUid = currentUser.uid;
          return profile;
        } catch (err) {
          console.warn("Unable to fetch user profile, defaulting role to 'user':", err);
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || "",
            name: currentUser.displayName || "User",
            role: "user",
            settings: {},
            created_at: new Date().toISOString(),
          };
          cachedUserProfile = fallbackProfile;
          cachedUserUid = currentUser.uid;
          return fallbackProfile;
        }
      })();

      const profile = await inFlightProfilePromise;
      setUserProfile(profile);
    } finally {
      inFlightProfilePromise = null;
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        if (cachedUserUid !== firebaseUser.uid) {
          // New or changed user session: fetch profile
          await fetchProfile(false);
        } else if (cachedUserProfile) {
          setUserProfile(cachedUserProfile);
        }
      } else {
        clearAuthProfileCache();
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
