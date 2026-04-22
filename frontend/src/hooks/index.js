import { useState, useEffect, useRef, useCallback } from "react";

// ─── useInfiniteScroll ────────────────────────────────────────────────────────
export function useInfiniteScroll(loadMore, { hasMore, loading }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !loading) loadMore();
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadMore]);

  return sentinelRef;
}

// ─── useDebounce ──────────────────────────────────────────────────────────────
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── useLocalStorage ──────────────────────────────────────────────────────────
export function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });

  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, val]);

  return [val, set];
}

// ─── useOnline ────────────────────────────────────────────────────────────────
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

// ─── useMediaQuery ────────────────────────────────────────────────────────────
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ─── useFetch ─────────────────────────────────────────────────────────────────
export function useFetch(apiFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFn();
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Request failed");
    }
    setLoading(false);
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useNotifications (browser push) ─────────────────────────────────────────
export function useNotifications() {
  const [permission, setPermission] = useState(Notification?.permission || "default");

  const request = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  };

  const notify = (title, options = {}) => {
    if (permission !== "granted") return;
    if (document.hasFocus()) return; // only when tab not focused
    new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      silent: false,
      ...options,
    });
  };

  return { permission, request, notify };
}

// ─── useClickOutside ─────────────────────────────────────────────────────────
export function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// ─── usePullToRefresh ─────────────────────────────────────────────────────────
export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const scrollEl = useRef(null);

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchMove  = (e) => {
    const el = scrollEl.current;
    if (!el || el.scrollTop > 0) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 80 && !refreshing) {
      setRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
    }
  };

  return { refreshing, scrollRef: scrollEl, handlers: { onTouchStart, onTouchMove } };
}
