import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { UserResponse, UserLogin, UserCreate } from "@/types/api";

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (data: UserLogin) => Promise<{ verified: boolean }>;
  register: (data: UserCreate) => Promise<UserResponse>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (data: UserLogin) => {
    const res = await api.post("/users/login", data);
    const t = res.data.access_token || res.data.token;
    if (!t) {
      // Not verified
      return { verified: false };
    }
    localStorage.setItem("token", t);
    setToken(t);
    const meRes = await api.get("/users/me", { headers: { Authorization: `Bearer ${t}` } });
    setUser(meRes.data);
    return { verified: true };
  };

  const register = async (data: UserCreate) => {
    const res = await api.post("/users/register", data);
    return res.data;
  };

  const refreshUser = async () => {
    await fetchMe();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
