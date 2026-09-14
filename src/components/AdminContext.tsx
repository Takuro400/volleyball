"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type AdminContextValue = {
  admin: boolean;
  checked: boolean;
  login: (passphrase: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue>({
  admin: false,
  checked: false,
  login: async () => "初期化されていません",
  logout: async () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((j) => setAdmin(j.admin === true))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const login = useCallback(async (passphrase: string) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return (json as { error?: string }).error ?? "ログインに失敗しました";
    }
    setAdmin(true);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, checked, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}
