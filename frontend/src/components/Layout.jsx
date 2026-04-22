import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Film, Send, User, Settings, BarChart2 } from "lucide-react";
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
    path === "/"                  ? "home"     :
    path.startsWith("/explore")   ? "explore"  :
    path.startsWith("/reels")     ? "reels"    :
    path.startsWith("/search")    ? "search"   :
    path.startsWith("/notifs")    ? "notifs"   :
    path.startsWith("/messages")  ? "messages" :
    path === "/profile" || path === `/${user?.username}` ? "profile" : "";

  const showHeader = !path.startsWith("/messages/");

  return (
    <div className="app-shell">
      {showHeader && (
        <header className="header">
          {tab === "home" ? (
            <>
              <span className="header-logo">Yor Talks</span>
              <div className="header-actions">
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
                <button className="action-btn" onClick={() => nav("/analytics")}><BarChart2 size={22} color="var(--text)" /></button>
                <button className="action-btn" onClick={() => nav("/settings")}><Settings size={22} color="var(--text)" /></button>
              </div>
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
          { id:"home",    icon:<Home size={26}/>,    path:"/" },
          { id:"search",  icon:<Search size={26}/>,  path:"/search" },
          { id:"create",  icon:<PlusSquare size={26}/>, path:null },
          { id:"reels",   icon:<Film size={26}/>,    path:"/reels" },
          { id:"profile",
            icon: user?.avatar
              ? <img src={user.avatar} alt="" className="avatar"
                  style={{ width:28, height:28, outline: tab==="profile"?"2.5px solid var(--text)":"none", outlineOffset:2 }}
                  onError={e => { e.target.style.display="none"; }}
                />
              : <User size={26} />,
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
            {n.icon}
          </button>
        ))}
      </nav>

      {showCreate && <CreatePost onClose={() => setShowCreate(false)} />}
    </div>
  );
}
