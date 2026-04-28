import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Film, Send, User, Settings, BarChart2, Radio, ShoppingBag, Zap, DollarSign } from "lucide-react";
import { useStore } from "../store/index.js";
import CreatePost from "./CreatePost.jsx";
import { notifsApi } from "../api/index.js";

export default function Layout() {
  const { user, unreadNotifs, unreadMessages, setUnreadNotifs } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user) return;
    notifsApi.list(1).then(r => setUnreadNotifs(r.data.unread || 0)).catch(() => {});
    const t = setInterval(() => {
      notifsApi.list(1).then(r => setUnreadNotifs(r.data.unread || 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  const path = loc.pathname;
  const tab =
    path === "/"                       ? "home"     :
    path.startsWith("/explore")        ? "explore"  :
    path.startsWith("/reels")          ? "reels"    :
    path.startsWith("/search")         ? "search"   :
    path.startsWith("/notifs")         ? "notifs"   :
    path.startsWith("/messages")       ? "messages" :
    path.startsWith("/live")           ? "live"     :
    path.startsWith("/shop")           ? "shop"     :
    path.startsWith("/ai-studio")      ? "ai"       :
    path.startsWith("/creator-studio") ? "creator"  :
    path.startsWith("/monetize")       ? "creator"  :
    path === "/profile" || path === `/${user?.username}` ? "profile" : "";

  const showHeader = !path.startsWith("/messages/") &&
    !path.startsWith("/live/studio") &&
    !path.startsWith("/ai-studio") &&
    !path.startsWith("/creator-studio") &&
    !path.startsWith("/monetize") &&
    !path.startsWith("/shop");

  return (
    <div className="app-shell">
      {showHeader && (
        <header className="header">
          {tab === "home" ? (
            <>
              <span className="header-logo">Yor Talks</span>
              <div className="header-actions">
                <button className="action-btn" onClick={() => nav("/ai-studio")} title="AI Studio" style={{ position:"relative" }}>
                  <Zap size={22} color="var(--text)" />
                  <span style={{ position:"absolute", top:0, right:0, width:6, height:6, background:"#f59e0b", borderRadius:"50%", border:"1px solid var(--bg)" }} />
                </button>
                <button className="action-btn" onClick={() => setShowCreate(true)} title="Create">
                  <PlusSquare size={24} color="var(--text)" />
                </button>
                <button className="action-btn" onClick={() => nav("/messages")} title="Messages" style={{ position:"relative" }}>
                  <Send size={24} color="var(--text)" />
                  {unreadMessages > 0 && (
                    <span style={{ position:"absolute", top:-1, right:-1, background:"var(--danger)", color:"#fff", borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, border:"1.5px solid var(--bg)" }}>
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : tab === "profile" ? (
            <>
              <span style={{ fontWeight:700, fontSize:17 }}>{user?.username}</span>
              <div className="header-actions">
                <button className="action-btn" onClick={() => nav("/monetize")}><DollarSign size={22} color="#22c55e" /></button>
                <button className="action-btn" onClick={() => nav("/analytics")}><BarChart2 size={22} color="var(--text)" /></button>
                <button className="action-btn" onClick={() => nav("/settings")}><Settings size={22} color="var(--text)" /></button>
              </div>
            </>
          ) : tab === "live" ? (
            <>
              <span style={{ fontWeight:700, fontSize:18, display:"flex", alignItems:"center", gap:6 }}>
                <Radio size={16} color="#ef4444" />Live
              </span>
              <button className="action-btn" onClick={() => nav("/live/studio")} style={{ background:"#ef4444", borderRadius:20, padding:"4px 12px" }}>
                <span style={{ color:"#fff", fontWeight:700, fontSize:13 }}>Go Live</span>
              </button>
            </>
          ) : tab === "shop" ? (
            <>
              <span style={{ fontWeight:700, fontSize:18 }}>🛍️ Shop</span>
            </>
          ) : (
            <span style={{ fontWeight:700, fontSize:18 }}>
              {tab === "explore" ? "Explore" : tab === "reels" ? "Reels" : tab === "search" ? "Search" : tab === "notifs" ? "Notifications" : ""}
            </span>
          )}
        </header>
      )}

      <main className="screen"><Outlet /></main>

      <nav className="bottom-nav">
        {[
          { id:"home",    icon:<Home size={25}/>,         path:"/" },
          { id:"search",  icon:<Search size={25}/>,       path:"/search" },
          { id:"create",  icon:<PlusSquare size={25}/>,   path:null },
          { id:"live",    icon:<Radio size={25}/>,        path:"/live" },
          { id:"shop",    icon:<ShoppingBag size={25}/>,  path:"/shop" },
          {
            id:"profile",
            icon: user?.avatar
              ? <img src={user.avatar} alt="" className="avatar"
                  style={{ width:27, height:27, outline: tab==="profile"?"2.5px solid var(--text)":"none", outlineOffset:2 }}
                  onError={e => { e.target.style.display="none"; }}
                />
              : <User size={25} />,
            path:"/profile"
          },
        ].map(n => (
          <button
            key={n.id}
            className={`nav-btn${tab===n.id?" active":""}`}
            onClick={() => n.path ? nav(n.path) : setShowCreate(true)}
          >
            {n.id === "notifs" && unreadNotifs > 0 && (
              <span className="badge">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
            )}
            {n.id === "live" && <span style={{ position:"absolute", top:8, right:"calc(50% - 16px)", width:6, height:6, background:"#ef4444", borderRadius:"50%", animation:"pulse 2s infinite" }} />}
            {n.icon}
          </button>
        ))}
      </nav>

      {showCreate && <CreatePost onClose={() => setShowCreate(false)} />}
    </div>
  );
}
