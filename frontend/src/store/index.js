import { create } from "zustand";
import { authApi, setTokens } from "../api/index.js";

export const useStore = create((set, get) => ({
  // ── auth ──────────────────────────────────────────────────────────────────
  user:        null,
  authLoaded:  false,

  setUser: (user) => set({ user }),

  loadMe: async () => {
    const token = localStorage.getItem("yt_access");
    if (!token) return set({ authLoaded: true });
    try {
      const { data } = await authApi.me();
      set({ user: data.user, authLoaded: true });
    } catch {
      set({ authLoaded: true });
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    setTokens(null, null);
    set({ user: null, unreadNotifs: 0 });
  },

  // ── online presence ───────────────────────────────────────────────────────
  onlineUsers: new Set(),
  setOnline: (userId, status) => set(s => {
    const next = new Set(s.onlineUsers);
    status ? next.add(userId) : next.delete(userId);
    return { onlineUsers: next };
  }),
  isOnline: (userId) => get().onlineUsers.has(userId),

  // ── notifications ─────────────────────────────────────────────────────────
  unreadNotifs:  0,
  unreadMessages: 0,
  setUnreadNotifs:   (n) => set({ unreadNotifs: n }),
  setUnreadMessages: (n) => set({ unreadMessages: n }),
  incUnreadMessages: ()  => set(s => ({ unreadMessages: s.unreadMessages + 1 })),

  // ── toasts ────────────────────────────────────────────────────────────────
  toasts: [],
  showToast: (message, type = "info") => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3800);
  },

  // ── active conversation ───────────────────────────────────────────────────
  activeConvId: null,
  setActiveConv: (id) => set({ activeConvId: id }),

  // ── post like/save optimistic updates (global) ────────────────────────────
  postStates: {},  // { [postId]: { is_liked, likes_count, is_saved } }
  setPostState: (postId, state) => set(s => ({
    postStates: { ...s.postStates, [postId]: { ...s.postStates[postId], ...state } },
  })),
}));
