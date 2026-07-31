import { create } from "zustand";
import Cookies from "js-cookie";

interface AuthState {
  token: string | null;
  isAdmin: boolean;
  /** Cookies only exist in the browser, so nothing may read auth state until after mount. */
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (session: { token: string; isAdmin: boolean; expiresAt: number }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAdmin: false,
  isHydrated: false,

  hydrate: () => {
    const token = Cookies.get("token") ?? null;
    const isAdmin = Cookies.get("isAdmin") === "1";
    const validUntil = Number(Cookies.get("validUntil") ?? 0);
    if (!token || (validUntil > 0 && validUntil < Date.now())) {
      Cookies.remove("token");
      Cookies.remove("isAdmin");
      Cookies.remove("validUntil");
      set({ token: null, isAdmin: false, isHydrated: true });
      return;
    }
    set({ token, isAdmin, isHydrated: true });
  },

  setSession: ({ token, isAdmin, expiresAt }) => {
    const expires = new Date(expiresAt);
    Cookies.set("token", token, { expires, sameSite: "strict" });
    Cookies.set("isAdmin", isAdmin ? "1" : "0", { expires, sameSite: "strict" });
    Cookies.set("validUntil", String(expiresAt), { expires, sameSite: "strict" });
    set({ token, isAdmin, isHydrated: true });
  },

  clearSession: () => {
    Cookies.remove("token");
    Cookies.remove("isAdmin");
    Cookies.remove("validUntil");
    set({ token: null, isAdmin: false });
  },
}));
