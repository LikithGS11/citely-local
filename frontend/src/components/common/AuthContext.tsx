"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "viewer";
  department: string;
}

const DEMO_ACCOUNTS: User[] = [
  {
    id: 1,
    email: "admin@enterprise.ai",
    full_name: "Dr. Elena Vance (Chief AI Officer)",
    role: "admin",
    department: "General",
  },
  {
    id: 2,
    email: "hr@enterprise.ai",
    full_name: "Marcus Sterling (VP Human Resources)",
    role: "manager",
    department: "HR",
  },
  {
    id: 3,
    email: "finance@enterprise.ai",
    full_name: "Samantha Chen (Senior Financial Controller)",
    role: "manager",
    department: "Finance",
  },
  {
    id: 4,
    email: "engineer@enterprise.ai",
    full_name: "Devon Taylor (Staff Infrastructure Engineer)",
    role: "viewer",
    department: "Engineering",
  },
];

interface AuthContextType {
  user: User;
  demoAccounts: User[];
  switchUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(DEMO_ACCOUNTS[0]);

  useEffect(() => {
    const savedUser = localStorage.getItem("enterprise_rag_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Could not parse stored user:", e);
      }
    }
  }, []);

  const switchUser = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem("enterprise_rag_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(DEMO_ACCOUNTS[0]);
    localStorage.removeItem("enterprise_rag_user");
  };

  return (
    <AuthContext.Provider value={{ user, demoAccounts: DEMO_ACCOUNTS, switchUser, logout }}>
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
