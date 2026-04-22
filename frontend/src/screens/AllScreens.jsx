import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X, Grid, Film, Tag, Settings, UserPlus, BarChart2, Bell, Archive, Bookmark, Heart, MessageCircle, Phone, Video, Send, Camera, Edit, Users, Flag, Shield, TrendingUp, ChevronRight, Lock, Eye, Moon } from "lucide-react";
import { authApi, postsApi, usersApi, storiesApi, messagesApi, notifsApi, searchApi, exploreApi, analyticsApi, adminApi, setTokens } from "../api/index.js";
import { useStore } from "../store/index.js";
import { PostCard, StoryBar } from "../components/PostCard.jsx";
import { getSocket } from "../hooks/useSocket.js";
import { formatDistanceToNowStrict, format } from "date-fns";

const fmtNum = n => n >= 1000000 ? (n/1000000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : (n||0).toString();
const timeAgo = t => { try { return formatDistanceToNowStrict(new Date(t)); } catch { return ""; } };

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div style={{ borderBottom:"1px solid var(--border)", padding:"12px" }}>
      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <div className="skeleton" style={{ width:36, height:36, borderRadius:"50%" }} />
        <div style={{ flex:1 }}>
          <div className="skeleton" style={{ width:120, height:13, marginBottom:6 }} />
          <div className="skeleton" style={{ width:80, height:11 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width:"100%", aspectRatio:"1", marginBottom:12 }} />
      <div className="skeleton" style={{ width:80, height:13, marginBottom:6 }} />
      <div className="skeleton" style={{ width:220, height:13 }} />
    </div>
  );
}

// ─── FollowButton ─────────────────────────────────────────────────────────────
export function FollowBtn({ user: u, size="md" }) {
  const [following, setFollowing] = useState(u.is_following);
  const [requested, setRequested] = useState(u.has_requested);
  const me = useStore(s => s.user);

  if (u.id === me?.id) return null;

  const toggle = async () => {
    try {
      const { data } = await usersApi.follow(u.username);
      setFollowing(!!data.is_following);
      setRequested(!!data.has_requested);
    } catch {}
  };

  const label = following ? "Following" : requested ? "Requested" : "Follow";
  const pad = size === "sm" ? "6px 14px" : "8px 18px";

  return (
    <button onClick={toggle} className={`btn-follow${following || requested ? " following" : ""}`} style={{ padding: pad }}>
      {label}
    </button>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
export function AuthScreen() {
  const [tab,  setTab]  = useState("login");
  const [form, setForm] = useState({ email:"", password:"", name:"", username:"" });
  const [err,  setErr]  = useState("");
  const [load, setLoad] = useState(false);
  const [need2fa, setNeed2fa] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const nav = useNavigate();
  const { setUser, showToast } = useStore();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setErr(""); setLoad(true);
    try {
      let data;
      if (tab === "login") {
        const r = await authApi.login(form.email, form.password, need2fa ? totpCode : undefined);
        if (r.data.requires_2fa) { setNeed2fa(true); setLoad(false); return; }
        data = r.data;
      } else {
        if (!form.name || !form.username) { setErr("All fields required"); setLoad(false); return; }
        ({ data } = await authApi.register(form));
      }
      setTokens(data.access, data.refresh);
      setUser(data.user);
      showToast(`Welcome, ${data.user.name}! 🎉`, "success");
      nav("/");
    } catch (e) {
      setErr(e.response?.data?.error || e.response?.data?.errors?.[0]?.msg || "Something went wrong");
    }
    setLoad(false);
  };

  const inp = { className:"input", style:{ marginBottom:10 }, onKeyDown: e => e.key === "Enter" && submit() };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"var(--font)" }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:52, fontFamily:"'Dancing Script',cursive", fontWeight:700, background:"var(--gradient)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1.1 }}>Yor Talks</div>
          <div style={{ color:"var(--text2)", fontSize:14, marginTop:10 }}>Share your world with those who matter</div>
        </div>

        {need2fa ? (
          <>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔐</div>
              <div style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Two-Factor Authentication</div>
              <div style={{ color:"var(--text2)", fontSize:14 }}>Enter the code from your authenticator app</div>
            </div>
            <input {...inp} placeholder="6-digit code" value={totpCode} onChange={e => setTotpCode(e.target.value)} style={{ ...inp.style, textAlign:"center", letterSpacing:8, fontSize:22 }} maxLength={6} />
            {err && <div style={{ color:"var(--danger)", fontSize:13, marginBottom:10 }}>{err}</div>}
            <button className="btn-primary" onClick={submit} disabled={load}>{load ? "Verifying…" : "Verify"}</button>
          </>
        ) : (
          <>
            <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:24 }}>
              {["login","signup"].map(t => (
                <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{ flex:1, padding:"12px 0", background:"none", border:"none", cursor:"pointer", color: tab===t ? "var(--text)" : "var(--text2)", fontWeight: tab===t ? 700 : 400, fontSize:14, fontFamily:"var(--font)", borderBottom: tab===t ? "2px solid var(--text)" : "2px solid transparent", transition:"all .2s" }}>
                  {t === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>

            {tab === "signup" && <>
              <input {...inp} placeholder="Full name"  value={form.name}     onChange={set("name")} />
              <input {...inp} placeholder="Username"   value={form.username} onChange={set("username")} />
            </>}
            <input {...inp} type="email"    placeholder="Email"    value={form.email}    onChange={set("email")} />
            <input {...inp} type="password" placeholder="Password" value={form.password} onChange={set("password")} />

            {err && <div style={{ color:"var(--danger)", fontSize:13, marginBottom:10 }}>{err}</div>}

            <button className="btn-primary" onClick={submit} disabled={load} style={{ marginBottom:10 }}>
              {load ? "Loading…" : tab === "login" ? "Log In" : "Create Account"}
            </button>

            {tab === "login" && <div style={{ textAlign:"center", marginBottom:16 }}>
              <button onClick={() => nav("/auth/forgot")} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:13, cursor:"pointer", fontFamily:"var(--font)" }}>Forgot password?</button>
            </div>}

            <div style={{ textAlign:"center", margin:"16px 0", color:"var(--text3)", fontSize:12 }}>— OR —</div>
            <button className="btn-ghost" style={{ width:"100%" }} onClick={() => {
              setForm(f => ({ ...f, email:"yor@yortalks.com", password:"password123" }));
              setTab("login");
            }}>🚀 Use Demo Account</button>
            <div style={{ textAlign:"center", color:"var(--text3)", fontSize:11, marginTop:8 }}>yor@yortalks.com · password123</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
export function HomeScreen() {
  const [posts,   setPosts]   = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [more,    setMore]    = useState(false);
  const { user } = useStore();
  const sentinel = useRef(null);

  const loadFeed = useCallback(async (p=1, replace=false) => {
    try {
      const { data } = await postsApi.feed(p);
      const items = data.items || [];
      setPosts(prev => replace ? items : [...prev, ...items]);
      setHasMore(data.meta?.hasMore ?? false);
      setPage(p);
    } catch {}
    setLoading(false); setMore(false);
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const { data } = await storiesApi.feed();
      const g = data.story_groups || [];
      // Add own-story slot if not present
      if (!g.find(x => x.user_id === user?.id)) {
        g.unshift({ user_id: user?.id, username: user?.username, avatar: user?.avatar, all_seen: true, stories: [] });
      }
      setGroups(g);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    loadFeed(1, true);
    loadStories();
    const refresh = () => loadFeed(1, true);
    window.addEventListener("refresh-feed", refresh);
    return () => window.removeEventListener("refresh-feed", refresh);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !more) { setMore(true); loadFeed(page+1); }
    }, { threshold:0.1 });
    if (sentinel.current) obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [hasMore, more, page, loadFeed]);

  const removePost = id => setPosts(ps => ps.filter(p => p.id !== id));

  return (
    <div>
      <StoryBar groups={groups} />
      {loading ? [1,2,3].map(i => <PostSkeleton key={i} />) :
       posts.length === 0
        ? <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}><div style={{ fontSize:48, marginBottom:12 }}>📸</div><div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Your feed is empty</div><div style={{ fontSize:14 }}>Follow people to see their posts here.</div></div>
        : posts.map(p => <PostCard key={p.id} post={p} onDelete={removePost} />)
      }
      {more && <div style={{ display:"flex", justifyContent:"center", padding:20 }}><div className="spinner" /></div>}
      <div ref={sentinel} style={{ height:10 }} />
    </div>
  );
}

// ─── EXPLORE SCREEN ───────────────────────────────────────────────────────────
export function ExploreScreen() {
  const [posts,    setPosts]    = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    exploreApi.trending().then(r => {
      setTrending(r.data.hashtags || []);
    }).catch(() => {});
    postsApi.explore().then(r => {
      setPosts(r.data.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Trending hashtags */}
      {trending.length > 0 && (
        <div style={{ padding:"14px 14px 4px" }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>Trending</div>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
            {trending.slice(0,10).map(t => (
              <button key={t.name} onClick={() => nav(`/hashtag/${t.name}`)} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"6px 14px", color:"var(--text)", fontSize:13, cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap", flexShrink:0 }}>
                #{t.name} <span style={{ color:"var(--text3)", fontSize:11 }}>{fmtNum(t.posts_count)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading
        ? <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:2 }}>{Array.from({length:12}).map((_,i) => <div key={i} className="skeleton" style={{ aspectRatio:"1" }} />)}</div>
        : <div className="explore-grid">
            {posts.map((p,i) => (
              <div key={p.id} onClick={() => nav(`/p/${p.id}`)} className={`explore-cell${i%7===0?" tall":""}`} style={{ aspectRatio: i%7===0 ? "1/2" : "1" }}>
                <img src={p.image_url} alt="" loading="lazy" onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300/300`; }} />
                {(p.media_count > 1) && <div style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.6)", borderRadius:4, padding:"2px 5px", fontSize:11, color:"#fff" }}>+{p.media_count}</div>}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── SEARCH SCREEN ────────────────────────────────────────────────────────────
export function SearchScreen() {
  const [q,       setQ]       = useState("");
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    searchApi.history().then(r => setHistory(r.data.history||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    clearTimeout(debounce.current);
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const { data } = await searchApi.search(q);
        setResults(data);
      } catch {}
      setLoading(false);
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [q]);

  return (
    <div>
      <div style={{ padding:"12px 14px", position:"sticky", top:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(10px)", zIndex:20, borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", background:"var(--surface)", borderRadius:12, padding:"10px 14px", gap:10 }}>
          <Search size={17} color="var(--text3)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users, posts, hashtags…"
            style={{ background:"none", border:"none", color:"var(--text)", fontSize:15, outline:"none", fontFamily:"var(--font)", flex:1 }} autoFocus />
          {q && <button onClick={() => setQ("")} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={15} color="var(--text3)" /></button>}
        </div>
      </div>

      {!results ? (
        <div style={{ padding:"14px 16px" }}>
          {history.length > 0 && <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontWeight:700, fontSize:15 }}>Recent</span>
              <button onClick={() => { searchApi.clearHistory(); setHistory([]); }} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:13, cursor:"pointer", fontFamily:"var(--font)" }}>Clear all</button>
            </div>
            {history.slice(0,10).map(h => (
              <div key={h.id} onClick={() => setQ(h.query)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", cursor:"pointer" }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Search size={16} color="var(--text2)" />
                </div>
                <span style={{ fontSize:14 }}>{h.query}</span>
              </div>
            ))}
          </>}
        </div>
      ) : (
        <div style={{ padding:"8px 0" }}>
          {loading && <div style={{ textAlign:"center", padding:20 }}><div className="spinner" /></div>}

          {/* Users */}
          {results.users?.length > 0 && <>
            <div style={{ padding:"10px 16px 4px", fontWeight:700, fontSize:13, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em" }}>People</div>
            {results.users.map(u => (
              <div key={u.id} onClick={() => nav(`/${u.username}`)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer" }}>
                <img src={u.avatar} alt="" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/48?u=${u.id}`; }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{u.username}</div>
                  <div style={{ color:"var(--text2)", fontSize:13 }}>{u.name} · {fmtNum(u.followers_count)} followers</div>
                </div>
              </div>
            ))}
          </>}

          {/* Hashtags */}
          {results.hashtags?.length > 0 && <>
            <div style={{ padding:"10px 16px 4px", fontWeight:700, fontSize:13, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Hashtags</div>
            {results.hashtags.map(h => (
              <div key={h.id} onClick={() => nav(`/hashtag/${h.name}`)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer" }}>
                <div style={{ width:48, height:48, borderRadius:"50%", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>#</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>#{h.name}</div>
                  <div style={{ color:"var(--text2)", fontSize:13 }}>{fmtNum(h.posts_count)} posts</div>
                </div>
              </div>
            ))}
          </>}

          {!loading && !results.users?.length && !results.hashtags?.length && (
            <div style={{ textAlign:"center", padding:40, color:"var(--text2)", fontSize:14 }}>No results for "{q}"</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REELS SCREEN ─────────────────────────────────────────────────────────────
export function ReelsScreen() {
  const [reels,   setReels]   = useState([]);
  const [cur,     setCur]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked,   setLiked]   = useState({});
  const nav = useNavigate();

  useEffect(() => {
    exploreApi.reels().then(r => { setReels(r.data.reels||[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}><div className="spinner" /></div>;
  if (!reels.length) return <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}>No reels yet</div>;

  const r = reels[cur];

  return (
    <div style={{ position:"relative", height:"calc(100vh - 110px)", background:"#000", overflow:"hidden" }}>
      <img src={r.image_url||`https://picsum.photos/seed/reel${cur}/400/700`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0 }} onError={e => { e.target.src=`https://picsum.photos/seed/r${cur}/400/700`; }} />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 55%)" }} />

      {/* Dots */}
      <div style={{ position:"absolute", top:14, left:0, right:0, display:"flex", justifyContent:"center", gap:5 }}>
        {reels.map((_,i) => <div key={i} onClick={() => setCur(i)} style={{ width:i===cur?20:6, height:4, borderRadius:2, background:i===cur?"#fff":"rgba(255,255,255,0.4)", cursor:"pointer", transition:"width .25s" }} />)}
      </div>

      {/* Right actions */}
      <div style={{ position:"absolute", right:14, bottom:120, display:"flex", flexDirection:"column", alignItems:"center", gap:22 }}>
        <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => { setLiked(l=>({...l,[r.id]:!l[r.id]})); postsApi.like(r.id).catch(()=>{}); }}>
          <div style={{ fontSize:28 }}>{liked[r.id] ? "❤️" : "🤍"}</div>
          <div style={{ color:"#fff", fontSize:12, fontWeight:700, marginTop:2 }}>{fmtNum((r.likes_count||0)+(liked[r.id]?1:0))}</div>
        </div>
        <div style={{ textAlign:"center", cursor:"pointer" }} onClick={() => nav(`/p/${r.id}`)}>
          <div style={{ fontSize:28 }}>💬</div>
          <div style={{ color:"#fff", fontSize:12, fontWeight:700, marginTop:2 }}>{fmtNum(r.comments_count||r.comments||0)}</div>
        </div>
        <div style={{ textAlign:"center", cursor:"pointer" }}><div style={{ fontSize:28 }}>➦</div><div style={{ color:"#fff", fontSize:11, marginTop:2 }}>Share</div></div>
        <div style={{ fontSize:24, cursor:"pointer" }}>⋯</div>
      </div>

      {/* Bottom */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, cursor:"pointer" }} onClick={() => nav(`/${r.username}`)}>
          <img src={r.avatar||`https://i.pravatar.cc/40?u=${r.user_id}`} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:"2px solid #fff" }} />
          <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{r.username}</span>
          <span style={{ color:"#fff", fontSize:12, border:"1px solid rgba(255,255,255,0.6)", borderRadius:5, padding:"2px 10px" }}>Follow</span>
        </div>
        <div style={{ color:"#fff", fontSize:14, lineHeight:1.5, maxWidth:"80%" }}>{r.caption}</div>
        <div style={{ color:"rgba(255,255,255,0.55)", fontSize:13, marginTop:5 }}>🎵 Original Audio · {r.username}</div>
      </div>

      {/* Tap zones */}
      <div style={{ position:"absolute", inset:"60px 0 150px", display:"flex", zIndex:5 }}>
        <div style={{ flex:1 }} onClick={() => cur>0&&setCur(c=>c-1)} />
        <div style={{ flex:1 }} onClick={() => cur<reels.length-1&&setCur(c=>c+1)} />
      </div>
    </div>
  );
}

// ─── NOTIFS SCREEN ────────────────────────────────────────────────────────────
export function NotifsScreen() {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [followed,setFollowed]= useState({});
  const { setUnreadNotifs } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    notifsApi.list().then(r => {
      setNotifs(r.data.items||[]);
      setUnreadNotifs(0);
      notifsApi.readAll().catch(()=>{});
    }).catch(()=>{}).finally(() => setLoading(false));
  }, []);

  const LABELS = { like:"liked your post.", follow:"started following you.", comment:"commented on your post.", save:"saved your post.", mention:"mentioned you.", message:"sent you a message.", follow_accepted:"accepted your follow request.", follow_request:"wants to follow you." };

  const groups = [
    { label:"Today",      items: notifs.filter(n => new Date(n.created_at) > new Date(Date.now()-86400000)) },
    { label:"This week",  items: notifs.filter(n => new Date(n.created_at) <= new Date(Date.now()-86400000) && new Date(n.created_at) > new Date(Date.now()-7*86400000)) },
    { label:"Earlier",    items: notifs.filter(n => new Date(n.created_at) <= new Date(Date.now()-7*86400000)) },
  ].filter(g => g.items.length);

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>;

  return (
    <div style={{ paddingBottom:20 }}>
      {notifs.length === 0 && <div style={{ textAlign:"center", padding:60 }}><Bell size={40} color="var(--text3)" style={{ marginBottom:12 }} /><div style={{ color:"var(--text2)", fontSize:15 }}>No notifications yet</div></div>}
      {groups.map(g => (
        <div key={g.label}>
          <div style={{ fontWeight:700, fontSize:15, padding:"16px 16px 8px" }}>{g.label}</div>
          {g.items.map(n => (
            <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", cursor:"pointer", background: n.is_read ? "transparent" : "rgba(0,149,246,0.05)" }}
              onClick={() => { notifsApi.read(n.id).catch(()=>{}); if(n.entity_id && n.entity_type==="post") nav(`/p/${n.entity_id}`); else if(n.type==="follow"||n.type==="follow_request") nav(`/${n.actor.username}`); }}>
              <img src={n.actor.avatar} alt="" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}
                onClick={e => { e.stopPropagation(); nav(`/${n.actor.username}`); }}
                onError={e => { e.target.src=`https://i.pravatar.cc/48?u=${n.actor.id}`; }} />
              <div style={{ flex:1, fontSize:14 }}>
                <span style={{ fontWeight:700 }}>{n.actor.username}</span>{" "}
                <span style={{ color:"var(--text2)" }}>{LABELS[n.type]||n.type}</span>
                <div style={{ color:"var(--text3)", fontSize:12, marginTop:2 }}>{timeAgo(n.created_at)}</div>
              </div>
              {(n.type==="follow"||n.type==="follow_request") ? (
                <button onClick={e => { e.stopPropagation(); usersApi.follow(n.actor.username).then(r=>setFollowed(f=>({...f,[n.id]:r.data.is_following}))).catch(()=>{}); }}
                  className={`btn-follow${followed[n.id]?"following":""}`} style={{ padding:"7px 16px", flexShrink:0 }}>
                  {followed[n.id] ? "Following" : "Follow"}
                </button>
              ) : n.entity_id ? (
                <img src={`https://picsum.photos/seed/${n.entity_id}/60/60`} alt="" style={{ width:46, height:46, objectFit:"cover", borderRadius:4, flexShrink:0 }} />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
export function ProfileScreen() {
  const { username } = useParams();
  const { user: me, logout } = useStore();
  const target = username || me?.username;
  const isMe = !username || username === me?.username;

  const [profile, setProfile] = useState(null);
  const [posts,   setPosts]   = useState([]);
  const [tab,     setTab]     = useState("posts");
  const [loading, setLoading] = useState(true);
  const [highlights, setHighlights] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!target) return;
    setLoading(true);
    Promise.all([
      usersApi.get(target),
      usersApi.posts(target),
    ]).then(([r1, r2]) => {
      setProfile(r1.data.user);
      setPosts(r2.data.items||[]);
    }).catch(()=>{}).finally(() => setLoading(false));
    storiesApi.highlights(target).then(r => setHighlights(r.data.highlights||[])).catch(()=>{});
  }, [target]);

  if (loading) return (
    <div style={{ padding:16 }}>
      <div style={{ display:"flex", gap:20, marginBottom:14 }}>
        <div className="skeleton" style={{ width:90, height:90, borderRadius:"50%", flexShrink:0 }} />
        <div style={{ flex:1, display:"flex", gap:24, alignItems:"center" }}>
          {[1,2,3].map(i => <div key={i} style={{ textAlign:"center" }}><div className="skeleton" style={{ width:40, height:18, margin:"0 auto 6px" }} /><div className="skeleton" style={{ width:56, height:12 }} /></div>)}
        </div>
      </div>
      <div className="skeleton" style={{ width:120, height:14, marginBottom:6 }} />
      <div className="skeleton" style={{ width:200, height:13, marginBottom:16 }} />
    </div>
  );

  if (!profile) return <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}>User not found</div>;

  return (
    <div>
      {!isMe && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 12px 0" }}>
          <button onClick={() => nav(-1)} className="action-btn"><ArrowLeft size={24} color="var(--text)" /></button>
          <span style={{ fontWeight:700, fontSize:17 }}>{profile.username}</span>
        </div>
      )}

      <div style={{ padding:16 }}>
        {/* Avatar + stats */}
        <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:14 }}>
          <div style={{ width:90, height:90, borderRadius:"50%", padding:2.5, background:"var(--gradient)", flexShrink:0 }}>
            <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:"var(--bg)", padding:2.5 }}>
              <img src={profile.avatar} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/90?u=${profile.id}`; }} />
            </div>
          </div>
          <div style={{ flex:1, display:"flex", gap:20 }}>
            {[{label:"Posts",v:profile.posts_count},{label:"Followers",v:profile.followers_count},{label:"Following",v:profile.following_count}].map(s => (
              <div key={s.label} style={{ textAlign:"center", cursor:"pointer" }}>
                <div style={{ fontWeight:700, fontSize:18 }}>{fmtNum(s.v||0)}</div>
                <div style={{ fontSize:13, color:"var(--text2)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontWeight:700, fontSize:15, marginBottom:3 }}>
            {profile.name}
            {profile.is_verified && <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0095f6"/><path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          {profile.bio && <div style={{ fontSize:14, lineHeight:1.55 }}>{profile.bio}</div>}
          {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" style={{ color:"var(--accent)", fontSize:14 }}>{profile.website.replace(/^https?:\/\//, "")}</a>}
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div style={{ display:"flex", gap:14, overflowX:"auto", marginBottom:14 }}>
            {highlights.map(h => (
              <div key={h.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", flexShrink:0 }}>
                <div style={{ width:62, height:62, borderRadius:"50%", border:"1.5px solid var(--border2)", overflow:"hidden" }}>
                  <img src={h.preview_url||`https://picsum.photos/seed/${h.id}/62/62`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
                <span style={{ fontSize:11, color:"var(--text2)", maxWidth:62, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {isMe ? (
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn-ghost" style={{ flex:1 }} onClick={() => nav("/edit-profile")}>Edit Profile</button>
            <button className="btn-ghost" style={{ flex:1 }} onClick={() => nav("/archive")}>Archive</button>
            <button className="btn-ghost" style={{ padding:"8px 12px" }} onClick={() => nav("/settings")}><Settings size={17} /></button>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <FollowBtn user={profile} />
            <button className="btn-ghost" style={{ flex:1 }} onClick={async () => {
              try { const { data } = await messagesApi.startDM(profile.id); nav(`/messages/${data.conversation_id}`); } catch {}
            }}>Message</button>
            <button className="btn-ghost" style={{ padding:"8px 12px" }}><UserPlus size={17} /></button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
        {[{id:"posts",icon:<Grid size={22}/>},{id:"reels",icon:<Film size={22}/>},{id:"tagged",icon:<Tag size={22}/>}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"13px 0", background:"none", border:"none", cursor:"pointer", color: tab===t.id ? "var(--text)" : "var(--text3)", borderBottom: tab===t.id ? "2px solid var(--text)" : "2px solid transparent" }}>
            {t.icon}
          </button>
        ))}
      </div>

      {tab==="posts" && (
        posts.length === 0
          ? <div style={{ textAlign:"center", padding:48, color:"var(--text2)" }}><div style={{ fontSize:40, marginBottom:10 }}>📷</div><div style={{ fontWeight:700, fontSize:16 }}>No posts yet</div></div>
          : <div className="profile-grid">
              {posts.map(p => (
                <div key={p.id} className="profile-grid-item" onClick={() => nav(`/p/${p.id}`)}>
                  <img src={p.image_url} alt="" loading="lazy" onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300`; }} />
                  <div className="overlay">
                    <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>❤️ {fmtNum(p.likes_count)}</span>
                    <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>💬 {fmtNum(p.comments_count)}</span>
                  </div>
                  {p.media_count > 1 && <div style={{ position:"absolute", top:6, right:6 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M3 11V3h8"/></svg></div>}
                </div>
              ))}
            </div>
      )}
      {tab==="tagged" && <div style={{ textAlign:"center", padding:48, color:"var(--text2)", fontSize:14 }}>No tagged posts</div>}
      {tab==="reels"  && <div style={{ textAlign:"center", padding:48, color:"var(--text2)", fontSize:14 }}>No reels yet</div>}
    </div>
  );
}

// ─── EDIT PROFILE SCREEN ──────────────────────────────────────────────────────
export function EditProfile() {
  const { user, setUser, showToast } = useStore();
  const [form,   setForm]   = useState({ name:user?.name||"", bio:user?.bio||"", website:user?.website||"", phone:user?.phone||"", gender:user?.gender||"" });
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await authApi.updateMe(form);
      setUser(data.user);
      showToast("Profile updated!", "success");
      nav(-1);
    } catch (e) { showToast(e.response?.data?.error||"Update failed", "error"); }
    setSaving(false);
  };

  const changeAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { data } = await authApi.uploadAvatar(f);
      setUser({ ...user, avatar: data.avatar });
      showToast("Photo updated!", "success");
    } catch { showToast("Upload failed", "error"); }
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)", fontSize:15, fontFamily:"var(--font)" }}>Cancel</button>
        <span style={{ fontWeight:700, fontSize:17 }}>Edit Profile</span>
        <button onClick={save} disabled={saving} style={{ background:"none", border:"none", color: saving ? "var(--text3)" : "var(--accent)", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"var(--font)" }}>{saving?"Saving…":"Done"}</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:24, borderBottom:"1px solid var(--border)" }}>
        <div style={{ width:80, height:80, borderRadius:"50%", padding:2, background:"var(--gradient)", marginBottom:12 }}>
          <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:"var(--bg)", padding:2 }}>
            <img src={user?.avatar} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/80?u=${user?.id}`; }} />
          </div>
        </div>
        <label style={{ color:"var(--accent)", fontSize:14, cursor:"pointer", fontWeight:600 }}>
          Change profile photo
          <input type="file" accept="image/*" style={{ display:"none" }} onChange={changeAvatar} />
        </label>
      </div>

      <div style={{ padding:"0 16px" }}>
        {[
          { label:"Name",    key:"name",    type:"text" },
          { label:"Username", key:"username", type:"text", disabled:true, value:user?.username, note:"Username cannot be changed" },
          { label:"Bio",     key:"bio",     type:"textarea" },
          { label:"Website", key:"website", type:"url" },
          { label:"Phone",   key:"phone",   type:"tel" },
        ].map(f => (
          <div key={f.key} style={{ borderBottom:"1px solid var(--border)", padding:"14px 0" }}>
            <div style={{ color:"var(--text2)", fontSize:12, marginBottom:5 }}>{f.label}</div>
            {f.type === "textarea"
              ? <textarea value={form[f.key]||""} onChange={e => setForm(x=>({...x,[f.key]:e.target.value}))} rows={3}
                  style={{ width:"100%", background:"none", border:"none", color:"var(--text)", fontSize:15, outline:"none", resize:"none", fontFamily:"var(--font)" }} />
              : <input type={f.type||"text"} value={(f.value ?? form[f.key]) || ""} disabled={f.disabled}
                  onChange={e => !f.disabled && setForm(x=>({...x,[f.key]:e.target.value}))}
                  style={{ width:"100%", background:"none", border:"none", color: f.disabled?"var(--text3)":"var(--text)", fontSize:15, outline:"none", fontFamily:"var(--font)" }} />
            }
            {f.note && <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>{f.note}</div>}
          </div>
        ))}

        <div style={{ padding:"14px 0", borderBottom:"1px solid var(--border)" }}>
          <div style={{ color:"var(--text2)", fontSize:12, marginBottom:5 }}>Gender</div>
          <select value={form.gender} onChange={e => setForm(x=>({...x,gender:e.target.value}))} style={{ background:"none", border:"none", color:"var(--text)", fontSize:15, fontFamily:"var(--font)", outline:"none", width:"100%" }}>
            {["","male","female","other"].map(g => <option key={g} value={g} style={{ background:"var(--surface)" }}>{g||"Prefer not to say"}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:"20px 16px" }}>
        <button onClick={() => nav("/settings")} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:14, cursor:"pointer", fontFamily:"var(--font)", display:"flex", alignItems:"center", gap:6 }}>
          <Lock size={15} /> Account privacy settings
        </button>
      </div>
    </div>
  );
}

// ─── MESSAGES SCREEN ──────────────────────────────────────────────────────────
export function MessagesScreen() {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const { user } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    messagesApi.conversations().then(r => { setConvs(r.data.conversations||[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = q ? convs.filter(c => c.members?.[0]?.username?.toLowerCase().includes(q.toLowerCase())) : convs;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 53px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 14px", borderBottom:"1px solid var(--border)", background:"rgba(0,0,0,0.95)" }}>
        <button onClick={() => nav(-1)} className="action-btn"><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:18, flex:1 }}>{user?.username}</span>
        <Edit size={22} color="var(--text)" style={{ cursor:"pointer" }} />
      </div>

      <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", background:"var(--surface)", borderRadius:"var(--radius)", padding:"9px 14px", gap:10 }}>
          <Search size={16} color="var(--text3)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ background:"none", border:"none", color:"var(--text)", fontSize:15, outline:"none", fontFamily:"var(--font)", flex:1 }} />
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {loading ? <div style={{ textAlign:"center", padding:30 }}><div className="spinner" /></div>
          : filtered.length === 0 ? <div style={{ textAlign:"center", padding:40, color:"var(--text2)", fontSize:14 }}>No messages yet</div>
          : filtered.map(c => {
              const other = c.members?.[0];
              if (!other) return null;
              return (
                <div key={c.id} onClick={() => nav(`/messages/${c.id}`)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer" }}>
                  <div style={{ position:"relative" }}>
                    <img src={other.avatar||`https://i.pravatar.cc/58?u=${other.id}`} alt="" style={{ width:58, height:58, borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/58?u=${other.id}`; }} />
                    <div style={{ position:"absolute", bottom:3, right:3, width:14, height:14, borderRadius:"50%", background:"var(--success)", border:"2.5px solid var(--bg)" }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{c.name || other.username}</div>
                    <div style={{ color:"var(--text2)", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {c.last_message?.text || "Start a conversation"} · {timeAgo(c.updated_at)}
                    </div>
                  </div>
                  {c.unread_count > 0 && <div style={{ background:"var(--accent)", color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>{c.unread_count > 9 ? "9+" : c.unread_count}</div>}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── CHAT SCREEN ──────────────────────────────────────────────────────────────
export function ChatScreen() {
  const { convId } = useParams();
  const [msgs,     setMsgs]    = useState([]);
  const [convInfo, setConvInfo] = useState(null);
  const [txt,      setTxt]     = useState("");
  const [loading,  setLoading] = useState(true);
  const [typing,   setTyping]  = useState(false);
  const { user, setActiveConv } = useStore();
  const nav = useNavigate();
  const botRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (!convId) return;
    setActiveConv(convId);

    const socket = getSocket();
    socket?.emit("join_conversation", convId);
    const onMsg = (msg) => {
      if (msg.conversation_id === convId) {
        setMsgs(m => [...m, msg]);
        setTimeout(() => botRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      }
    };
    const onTyping = ({ user_id, is_typing }) => { if (user_id !== user?.id) setTyping(is_typing); };
    socket?.on("new_message", onMsg);
    socket?.on("typing", onTyping);

    messagesApi.messages(convId).then(r => {
      setMsgs(r.data.items||[]);
      setLoading(false);
      setTimeout(() => botRef.current?.scrollIntoView(), 80);
    }).catch(() => setLoading(false));

    messagesApi.conversations().then(r => {
      const c = r.data.conversations?.find(x => x.id === convId);
      setConvInfo(c);
    }).catch(()=>{});

    return () => {
      setActiveConv(null);
      socket?.off("new_message", onMsg);
      socket?.off("typing", onTyping);
    };
  }, [convId]);

  const send = () => {
    if (!txt.trim()) return;
    const socket = getSocket();
    if (socket) {
      socket.emit("send_message", { conversation_id: convId, text: txt });
      // optimistic
      setMsgs(m => [...m, { id:Date.now().toString(), conversation_id:convId, sender_id:user?.id, text:txt, created_at:new Date().toISOString(), sender:user }]);
    }
    setTxt("");
    setTimeout(() => botRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
  };

  const onType = (val) => {
    setTxt(val);
    const socket = getSocket();
    socket?.emit("typing", { conversation_id:convId, is_typing:true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit("typing", { conversation_id:convId, is_typing:false }), 1500);
  };

  const other = convInfo?.members?.[0];
  const fmtTime = t => { try { return new Date(t).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 53px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 12px", borderBottom:"1px solid var(--border)", background:"rgba(0,0,0,0.95)", flexShrink:0 }}>
        <button onClick={() => nav("/messages")} className="action-btn"><ArrowLeft size={24} color="var(--text)" /></button>
        <img src={other?.avatar||`https://i.pravatar.cc/38?u=${other?.id}`} alt="" style={{ width:38, height:38, borderRadius:"50%", objectFit:"cover", cursor:"pointer" }} onClick={() => other && nav(`/${other.username}`)} />
        <div style={{ flex:1, cursor:"pointer" }} onClick={() => other && nav(`/${other.username}`)}>
          <div style={{ fontWeight:700, fontSize:15 }}>{convInfo?.name || other?.username || "…"}</div>
          <div style={{ color:"var(--success)", fontSize:12 }}>Active now</div>
        </div>
        <Phone size={22} color="var(--text)" style={{ cursor:"pointer", marginRight:14 }} />
        <Video size={22} color="var(--text)" style={{ cursor:"pointer" }} />
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 12px", display:"flex", flexDirection:"column", gap:6 }}>
        {loading && <div style={{ textAlign:"center", padding:20 }}><div className="spinner" /></div>}
        {msgs.map((m,i) => {
          const isMe = m.sender_id === user?.id;
          return (
            <div key={m.id||i} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems:"flex-end", gap:6 }}>
              {!isMe && <img src={m.sender?.avatar||other?.avatar||`https://i.pravatar.cc/26?u=x`} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover", flexShrink:0, marginBottom:2 }} onError={e => { e.target.src=`https://i.pravatar.cc/26?u=${m.sender_id}`; }} />}
              <div style={{ maxWidth:"72%" }}>
                <div className={`msg-bubble ${isMe?"me":"them"}`}>{m.is_deleted ? <em style={{ opacity:0.5 }}>Message deleted</em> : m.text}</div>
                <div style={{ fontSize:10, color:"var(--text3)", textAlign: isMe ? "right" : "left", marginTop:2 }}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        {typing && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src={other?.avatar||""} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover" }} />
            <div style={{ background:"var(--surface)", borderRadius:18, padding:"10px 14px", fontSize:14, color:"var(--text2)" }}>typing…</div>
          </div>
        )}
        <div ref={botRef} />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
        <Camera size={22} color="var(--text)" style={{ cursor:"pointer", flexShrink:0 }} />
        <input value={txt} onChange={e => onType(e.target.value)} placeholder="Message…" onKeyDown={e => e.key==="Enter"&&send()}
          style={{ flex:1, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:24, padding:"10px 16px", color:"var(--text)", fontSize:14, outline:"none", fontFamily:"var(--font)" }} />
        {txt
          ? <button onClick={send} style={{ background:"none", border:"none", color:"var(--accent)", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"var(--font)" }}>Send</button>
          : <span style={{ fontSize:24, cursor:"pointer" }}>❤️</span>
        }
      </div>
    </div>
  );
}

// ─── POST DETAIL SCREEN ───────────────────────────────────────────────────────
export function PostScreen() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    postsApi.get(postId).then(r => setPost(r.data.post)).catch(()=>{});
  }, [postId]);

  if (!post) return <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 12px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Post</span>
      </div>
      <PostCard post={post} />
    </div>
  );
}

// ─── SAVED SCREEN ─────────────────────────────────────────────────────────────
export function SavedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    postsApi.saved().then(r => { setPosts(r.data.items||[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Saved</span>
      </div>
      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>
        : posts.length === 0 ? <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}><Bookmark size={40} style={{ marginBottom:12 }} /><div style={{ fontWeight:700, fontSize:16 }}>No saved posts</div></div>
        : <div className="profile-grid">{posts.map(p => (<div key={p.id} className="profile-grid-item" onClick={() => nav(`/p/${p.id}`)}><img src={p.image_url} alt="" loading="lazy" onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300`; }} /></div>))}</div>
      }
    </div>
  );
}

// ─── ARCHIVE SCREEN ───────────────────────────────────────────────────────────
export function ArchiveScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    postsApi.archived().then(r => { setPosts(r.data.items||[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Archive</span>
      </div>
      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>
        : posts.length === 0 ? <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}><Archive size={40} style={{ marginBottom:12 }} /><div style={{ fontWeight:700, fontSize:16 }}>No archived posts</div></div>
        : <div className="profile-grid">{posts.map(p => (<div key={p.id} className="profile-grid-item" onClick={() => nav(`/p/${p.id}`)}><img src={p.image_url||p.media?.[0]?.url} alt="" loading="lazy" onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300`; }} /><div style={{ position:"absolute", bottom:6, left:6, background:"rgba(0,0,0,0.6)", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#fff" }}>Archived</div></div>))}</div>
      }
    </div>
  );
}

// ─── ANALYTICS SCREEN ─────────────────────────────────────────────────────────
export function AnalyticsScreen() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    analyticsApi.overview().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>;
  if (!data) return null;

  const StatCard = ({ label, value, sub, color="#0095f6" }) => (
    <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:"16px 14px", flex:1, minWidth:0 }}>
      <div style={{ fontSize:28, fontWeight:800, color }}>{fmtNum(value||0)}</div>
      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginTop:3 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Analytics</span>
      </div>

      <div style={{ padding:16 }}>
        {/* Overview */}
        <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Account Overview</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          <StatCard label="Followers" value={data.followers} sub={`+${data.new_followers_7d} this week`} />
          <StatCard label="Engagement" value={`${data.engagement_rate}%`} sub="avg. rate" color="#00c851" />
          <StatCard label="Total Likes" value={data.total_likes} color="#ff3040" />
          <StatCard label="Total Views" value={data.total_views} color="#bc1888" />
          <StatCard label="Saves" value={data.total_saves} color="#f09433" />
          <StatCard label="Comments" value={data.total_comments} color="#0095f6" />
        </div>

        {/* Weekly chart (simple bars) */}
        <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Last 7 Days</div>
        <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:16, marginBottom:20 }}>
          <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:80 }}>
            {(data.weekly||[]).map((d,i) => {
              const max = Math.max(...(data.weekly||[]).map(x=>x.likes||0), 1);
              const h = Math.max(4, ((d.likes||0)/max)*70);
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ width:"100%", height:h, background:"linear-gradient(to top,#f09433,#bc1888)", borderRadius:"3px 3px 0 0" }} />
                  <div style={{ fontSize:9, color:"var(--text3)" }}>{d.date?.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:12, color:"var(--text2)", marginTop:8, textAlign:"center" }}>Likes per day</div>
        </div>

        {/* Top posts */}
        {data.top_posts?.length > 0 && <>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Top Posts</div>
          {data.top_posts.map(p => (
            <div key={p.id} onClick={() => nav(`/p/${p.id}`)} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)", cursor:"pointer", alignItems:"center" }}>
              <img src={`https://picsum.photos/seed/${p.id}/60/60`} alt="" style={{ width:56, height:56, borderRadius:8, objectFit:"cover", flexShrink:0 }} onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/60`; }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:"var(--text)", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.caption||"No caption"}</div>
                <div style={{ display:"flex", gap:14, fontSize:12, color:"var(--text2)" }}>
                  <span>❤️ {fmtNum(p.likes_count)}</span>
                  <span>💬 {fmtNum(p.comments_count)}</span>
                  <span>🔖 {fmtNum(p.saves_count)}</span>
                </div>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
export function SettingsScreen() {
  const { user, logout, showToast } = useStore();
  const nav = useNavigate();

  const sections = [
    { title:"Account", items:[
      { icon:<User size={20}/>, label:"Edit Profile", action:()=>nav("/edit-profile") },
      { icon:<Lock size={20}/>, label:"Password & Security", action:()=>nav("/settings/security") },
      { icon:<Eye size={20}/>, label:"Privacy", sub: user?.is_private?"Private":"Public", action:()=>{ authApi.updateMe({is_private:!user?.is_private}).catch(()=>{}); showToast("Privacy updated"); } },
    ]},
    { title:"Content & Activity", items:[
      { icon:<Bookmark size={20}/>, label:"Saved Posts", action:()=>nav("/saved") },
      { icon:<Archive size={20}/>, label:"Archive", action:()=>nav("/archive") },
      { icon:<BarChart2 size={20}/>, label:"Analytics", action:()=>nav("/analytics") },
    ]},
    { title:"Support", items:[
      { icon:<Flag size={20}/>, label:"Report a Problem", action:()=>showToast("Thanks for the report!") },
      { icon:<Shield size={20}/>, label:"Privacy Policy", action:()=>window.open("https://yortalks.com/privacy","_blank") },
    ]},
    { title:"", items:[
      { icon:<Shield size={20}/>, label:"Admin Panel", hidden:!user?.is_admin, action:()=>nav("/admin") },
      { icon:<User size={20}/>, label:"Log Out", color:"var(--danger)", action: async () => { await logout(); nav("/auth"); } },
    ]},
  ];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Settings</span>
      </div>

      {/* Profile preview */}
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 16px 12px", borderBottom:"1px solid var(--border)", cursor:"pointer" }} onClick={() => nav("/profile")}>
        <img src={user?.avatar} alt="" style={{ width:52, height:52, borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/52?u=${user?.id}`; }} />
        <div>
          <div style={{ fontWeight:700, fontSize:16 }}>{user?.name}</div>
          <div style={{ color:"var(--text2)", fontSize:13 }}>@{user?.username}</div>
        </div>
        <ChevronRight size={18} color="var(--text3)" style={{ marginLeft:"auto" }} />
      </div>

      {sections.map(s => (
        <div key={s.title}>
          {s.title && <div style={{ padding:"14px 16px 6px", fontSize:13, color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.title}</div>}
          {s.items.filter(i => !i.hidden).map(item => (
            <button key={item.label} onClick={item.action} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"15px 16px", background:"none", border:"none", borderBottom:"1px solid var(--border)", cursor:"pointer", fontFamily:"var(--font)", color: item.color||"var(--text)", textAlign:"left" }}>
              <span style={{ color: item.color||"var(--text2)", flexShrink:0 }}>{item.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15 }}>{item.label}</div>
                {item.sub && <div style={{ fontSize:12, color:"var(--text3)" }}>{item.sub}</div>}
              </div>
              <ChevronRight size={16} color="var(--text3)" />
            </button>
          ))}
        </div>
      ))}
      <div style={{ height:40 }} />
    </div>
  );
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────────────────
export function AdminScreen() {
  const [tab,     setTab]     = useState("stats");
  const [stats,   setStats]   = useState(null);
  const [users,   setUsers]   = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: me } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    if (!me?.is_admin) { nav("/"); return; }
    Promise.all([
      adminApi.stats(),
      adminApi.users(),
      adminApi.reports(),
    ]).then(([s, u, r]) => {
      setStats(s.data.stats);
      setUsers(u.data.items||[]);
      setReports(r.data.items||[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const StatBox = ({ label, value, color="#0095f6" }) => (
    <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:"14px 12px", flex:1 }}>
      <div style={{ fontSize:24, fontWeight:800, color }}>{fmtNum(value||0)}</div>
      <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>Admin Panel</span>
        <span style={{ marginLeft:"auto", background:"var(--danger)", color:"#fff", fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:4 }}>ADMIN</span>
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid var(--border)" }}>
        {["stats","users","reports"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"12px 0", background:"none", border:"none", cursor:"pointer", color: tab===t ? "var(--text)" : "var(--text3)", fontWeight: tab===t ? 700 : 400, fontSize:13, fontFamily:"var(--font)", borderBottom: tab===t ? "2px solid var(--text)" : "2px solid transparent", textTransform:"capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div> : (
        <div style={{ padding:16 }}>
          {tab === "stats" && stats && (
            <>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Platform Stats</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                <StatBox label="Total Users"     value={stats.users} />
                <StatBox label="Total Posts"     value={stats.posts} color="#00c851" />
                <StatBox label="Active Stories"  value={stats.stories} color="#bc1888" />
                <StatBox label="DAU"             value={stats.dau} color="#f09433" />
                <StatBox label="New Users Today" value={stats.new_users_today} color="#0095f6" />
                <StatBox label="Pending Reports" value={stats.reports} color={stats.reports>0?"var(--danger)":"var(--text2)"} />
                <StatBox label="Posts Today"     value={stats.new_posts_today} color="#00c851" />
                <StatBox label="Messages Today"  value={stats.messages_today} />
              </div>
            </>
          )}

          {tab === "users" && (
            <div>
              {users.map(u => (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                  <img src={`https://i.pravatar.cc/40?u=${u.id}`} alt="" style={{ width:40, height:40, borderRadius:"50%", flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, display:"flex", alignItems:"center", gap:6 }}>
                      {u.username}
                      {u.is_verified && <span style={{ fontSize:11, background:"var(--accent)", color:"#fff", padding:"1px 6px", borderRadius:4 }}>✓</span>}
                      {u.is_banned && <span style={{ fontSize:11, background:"var(--danger)", color:"#fff", padding:"1px 6px", borderRadius:4 }}>BANNED</span>}
                      {u.is_admin && <span style={{ fontSize:11, background:"#bc1888", color:"#fff", padding:"1px 6px", borderRadius:4 }}>ADMIN</span>}
                    </div>
                    <div style={{ color:"var(--text2)", fontSize:12 }}>{u.email} · {fmtNum(u.followers_count)} followers</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    {!u.is_verified && <button onClick={() => adminApi.verifyUser(u.id)} style={{ background:"var(--accent)", color:"#fff", border:"none", borderRadius:4, padding:"4px 8px", fontSize:11, cursor:"pointer" }}>Verify</button>}
                    <button onClick={() => u.is_banned ? adminApi.unbanUser(u.id) : adminApi.banUser(u.id, "violation")} style={{ background: u.is_banned ? "var(--surface)" : "var(--danger)", color:"#fff", border: u.is_banned ? "1px solid var(--border)" : "none", borderRadius:4, padding:"4px 8px", fontSize:11, cursor:"pointer" }}>
                      {u.is_banned ? "Unban" : "Ban"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "reports" && (
            <div>
              {reports.length === 0 ? <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>No pending reports</div>
                : reports.map(r => (
                    <div key={r.id} style={{ padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>
                        <span style={{ background:"var(--danger)", color:"#fff", fontSize:11, padding:"2px 6px", borderRadius:4, marginRight:8 }}>{r.entity_type}</span>
                        {r.reason}
                      </div>
                      <div style={{ color:"var(--text2)", fontSize:12, marginBottom:8 }}>By @{r.reporter_username} · {timeAgo(r.created_at)}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => adminApi.resolveReport(r.id,"remove",r.entity_type).then(()=>setReports(x=>x.filter(y=>y.id!==r.id))).catch(()=>{})} style={{ background:"var(--danger)", color:"#fff", border:"none", borderRadius:4, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>Remove Content</button>
                        <button onClick={() => adminApi.resolveReport(r.id,"dismiss","").then(()=>setReports(x=>x.filter(y=>y.id!==r.id))).catch(()=>{})} style={{ background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:4, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--font)" }}>Dismiss</button>
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HASHTAG SCREEN ───────────────────────────────────────────────────────────
export function HashtagScreen() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [info,  setInfo]  = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    exploreApi.hashtag(tag).then(r => {
      setPosts(r.data.posts||[]);
      setInfo(r.data.hashtag);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tag]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} className="action-btn" style={{ marginRight:10 }}><ArrowLeft size={24} color="var(--text)" /></button>
        <span style={{ fontWeight:700, fontSize:17 }}>#{tag}</span>
      </div>
      <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ fontSize:28, fontWeight:800, marginBottom:4 }}>#{tag}</div>
        <div style={{ color:"var(--text2)", fontSize:14 }}>{fmtNum(info?.posts_count||posts.length)} posts</div>
      </div>
      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:30 }}><div className="spinner" /></div>
        : posts.length === 0 ? <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}>No posts with #{tag}</div>
        : <div className="profile-grid">{posts.map(p => (<div key={p.id} className="profile-grid-item" onClick={() => nav(`/p/${p.id}`)}><img src={p.image_url} alt="" loading="lazy" onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300`; }} /></div>))}</div>
      }
    </div>
  );
}
