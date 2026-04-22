import { Component, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wifi, WifiOff, ChevronRight } from "lucide-react";

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, textAlign:"center", minHeight:300 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>😵</div>
          <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Something went wrong</div>
          <div style={{ color:"var(--text2)", fontSize:14, marginBottom:24 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </div>
          <button className="btn-primary" style={{ width:"auto", padding:"10px 24px" }}
            onClick={() => { this.setState({ hasError:false, error:null }); window.location.reload(); }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── OfflineBanner ────────────────────────────────────────────────────────────
export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [show,   setShow]   = useState(false);

  useEffect(() => {
    const on  = () => { setOnline(true);  setShow(true); setTimeout(() => setShow(false), 3000); };
    const off = () => { setOnline(false); setShow(true); };
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    if (!navigator.onLine) setShow(true);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position:"fixed", top: online ? -60 : 0, left:0, right:0, zIndex:9998,
      background: online ? "var(--success)" : "#1a0000",
      border: `1px solid ${online ? "var(--success)" : "var(--danger)"}`,
      padding:"10px 16px", display:"flex", alignItems:"center", gap:8,
      justifyContent:"center", transition:"top .3s ease",
      maxWidth:480, margin:"0 auto",
    }}>
      {online
        ? <><Wifi size={15} color="#fff" /><span style={{ color:"#fff", fontSize:13, fontWeight:600 }}>Back online!</span></>
        : <><WifiOff size={15} color="var(--danger)" /><span style={{ color:"var(--danger)", fontSize:13, fontWeight:600 }}>No internet connection</span></>
      }
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, onBack, right, subtitle }) {
  const nav = useNavigate();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--bg)", position:"sticky", top:0, zIndex:20 }}>
      {(onBack !== false) && (
        <button onClick={onBack ?? (() => nav(-1))} className="action-btn">
          <ArrowLeft size={24} color="var(--text)" />
        </button>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:17, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:"var(--text2)", marginTop:1 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  );
}

// ─── VerifiedBadge ────────────────────────────────────────────────────────────
export function VerifiedBadge({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display:"inline-flex", verticalAlign:"middle", marginLeft:2, flexShrink:0 }}>
      <circle cx="12" cy="12" r="10" fill="#0095f6" />
      <path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ src, userId, size = 40, story = false, hasSeen = false, onClick }) {
  const fallback = `https://i.pravatar.cc/${size}?u=${userId || Math.random()}`;
  const inner = (
    <img
      src={src || fallback}
      alt=""
      className="avatar"
      style={{ width:size, height:size }}
      onError={e => { e.target.src = fallback; }}
      onClick={onClick}
    />
  );

  if (!story) return inner;
  return (
    <div style={{ width:size+4, height:size+4, borderRadius:"50%", padding:2, background: hasSeen ? "var(--border2)" : "var(--gradient)", flexShrink:0 }}>
      <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:"var(--bg)", padding:2 }}>
        {inner}
      </div>
    </div>
  );
}

// ─── UserRow ──────────────────────────────────────────────────────────────────
export function UserRow({ user, right, onClick, subtitle }) {
  const nav = useNavigate();
  return (
    <div onClick={onClick ?? (() => nav(`/${user.username}`))} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer" }}>
      <Avatar src={user.avatar} userId={user.id} size={48} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:4, fontWeight:700, fontSize:14 }}>
          {user.username}
          {user.is_verified && <VerifiedBadge size={13} />}
        </div>
        <div style={{ color:"var(--text2)", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {subtitle ?? (user.name || user.followers_count?.toLocaleString() + " followers")}
        </div>
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  );
}

// ─── LoadMore button ──────────────────────────────────────────────────────────
export function LoadMore({ loading, hasMore, onClick }) {
  if (!hasMore) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", padding:20 }}>
      {loading
        ? <div className="spinner" />
        : <button className="btn-ghost" onClick={onClick} style={{ padding:"9px 24px" }}>Load more</button>
      }
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"var(--radius-lg) var(--radius-lg) 0 0", width:"100%", padding:"24px 20px 32px" }}>
        <div style={{ fontWeight:700, fontSize:18, marginBottom:8, textAlign:"center" }}>{title}</div>
        {message && <div style={{ color:"var(--text2)", fontSize:14, marginBottom:24, textAlign:"center", lineHeight:1.6 }}>{message}</div>}
        <div style={{ display:"flex", gap:10, flexDirection:"column" }}>
          <button onClick={onConfirm} style={{ background: danger ? "var(--danger)" : "var(--accent)", color:"#fff", border:"none", borderRadius:"var(--radius-sm)", padding:14, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)" }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="btn-ghost" style={{ width:"100%", padding:13 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Switch Toggle ────────────────────────────────────────────────────────────
export function Switch({ value, onChange }) {
  return (
    <button className={`switch${value ? " on" : ""}`} onClick={() => onChange(!value)} />
  );
}

// ─── Skeleton components ──────────────────────────────────────────────────────
export function PostSkeleton() {
  return (
    <div style={{ borderBottom:"1px solid var(--border)", padding:12 }}>
      <div style={{ display:"flex", gap:10, marginBottom:12 }}>
        <div className="skeleton skeleton-circle" style={{ width:36, height:36, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div className="skeleton" style={{ width:120, height:13, marginBottom:7 }} />
          <div className="skeleton" style={{ width:80, height:11 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width:"100%", aspectRatio:"1", marginBottom:12 }} />
      <div className="skeleton" style={{ width:90, height:13, marginBottom:7 }} />
      <div className="skeleton" style={{ width:220, height:13 }} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div style={{ padding:16 }}>
      <div style={{ display:"flex", gap:20, marginBottom:16 }}>
        <div className="skeleton skeleton-circle" style={{ width:90, height:90, flexShrink:0 }} />
        <div style={{ flex:1, display:"flex", gap:24, alignItems:"center" }}>
          {[1,2,3].map(i => <div key={i} style={{ textAlign:"center" }}><div className="skeleton" style={{ width:40, height:20, margin:"0 auto 6px" }} /><div className="skeleton" style={{ width:58, height:12 }} /></div>)}
        </div>
      </div>
      <div className="skeleton" style={{ width:130, height:15, marginBottom:7 }} />
      <div className="skeleton" style={{ width:200, height:13, marginBottom:6 }} />
      <div className="skeleton" style={{ width:160, height:13, marginBottom:16 }} />
      <div style={{ display:"flex", gap:8 }}>
        <div className="skeleton" style={{ flex:1, height:36, borderRadius:"var(--radius-sm)" }} />
        <div className="skeleton" style={{ flex:1, height:36, borderRadius:"var(--radius-sm)" }} />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 9 }) {
  return (
    <div className="profile-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ aspectRatio:"1" }} />
      ))}
    </div>
  );
}

export function NotifSkeleton() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} style={{ display:"flex", gap:12, padding:"12px 16px", alignItems:"center" }}>
      <div className="skeleton skeleton-circle" style={{ width:48, height:48, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div className="skeleton" style={{ width:240, height:13, marginBottom:7 }} />
        <div className="skeleton" style={{ width:80, height:11 }} />
      </div>
    </div>
  ));
}
