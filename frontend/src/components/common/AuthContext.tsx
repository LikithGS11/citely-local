"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "viewer";
  department: string;
}

// Authentication is disabled: the backend runs every request as one local admin
// user. Profiles here are local display labels only — the API ignores them.
const SEED_PROFILES: User[] = [
  {
    id: 1,
    email: "local@enterprise.ai",
    full_name: "Local User",
    role: "admin",
    department: "General",
  },
];

const PROFILES_KEY = "enterprise_rag_profiles_v2";
const ACTIVE_USER_KEY = "enterprise_rag_user_v2";

interface AuthContextType {
  user: User;
  profiles: User[];
  switchUser: (user: User) => void;
  addProfile: (profile: Omit<User, "id">) => User;
  removeProfile: (id: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<User[]>(SEED_PROFILES);
  const [user, setUser] = useState<User>(SEED_PROFILES[0]);

  useEffect(() => {
    let loadedProfiles = SEED_PROFILES;
    const savedProfiles = localStorage.getItem(PROFILES_KEY);
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles);
        if (Array.isArray(parsed) && parsed.length > 0) loadedProfiles = parsed;
      } catch (e) {
        console.error("Could not parse stored profiles:", e);
      }
    }
    setProfiles(loadedProfiles);

    const savedUser = localStorage.getItem(ACTIVE_USER_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Only trust the saved active user if it still exists (it may have been removed)
        const stillExists = loadedProfiles.find((p) => p.id === parsedUser.id);
        setUser(stillExists || loadedProfiles[0]);
      } catch (e) {
        console.error("Could not parse stored user:", e);
      }
    }
  }, []);

  const persistProfiles = (next: User[]) => {
    setProfiles(next);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  };

  const switchUser = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(newUser));
  };

  const addProfile = (profile: Omit<User, "id">): User => {
    const newProfile: User = { ...profile, id: Date.now() };
    persistProfiles([...profiles, newProfile]);
    return newProfile;
  };

  const removeProfile = (id: number) => {
    if (profiles.length <= 1) return; // always keep at least one profile
    const next = profiles.filter((p) => p.id !== id);
    persistProfiles(next);
    if (user.id === id) {
      switchUser(next[0]);
    }
  };

  const logout = () => {
    switchUser(profiles[0]);
  };

  return (
    <AuthContext.Provider value={{ user, profiles, switchUser, addProfile, removeProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
