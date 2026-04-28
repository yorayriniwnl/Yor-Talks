/**
 * Yor Talks — Billion Dollar Screens
 * CreatorStudioScreen, MonetizeScreen, LiveScreen, AIStudioScreen, ShopScreen, MarketplaceScreen
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TrendingUp, DollarSign, Users, Heart, Star, Zap, Play, Radio,
  ShoppingBag, Camera, Wand2, BarChart3, ChevronRight, Plus, Check,
  ArrowLeft, Send, Gift, Crown, Sparkles, Mic, MicOff, Video, VideoOff,
  Package, Tag, ExternalLink, Clock, Target, Award, Flame, Globe,
  X, Edit2, Trash2, Eye, Share2, Copy, RefreshCw, ChevronDown
} from "lucide-react";
import { useStore } from "../store/index.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const token = () => localStorage.getItem("access_token");
const apiFetch = (path, opts = {}) => fetch(`${API}${path}`, {
  ...opts,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts.headers || {}) }
}).then(r => r.json());

const fmtNum = n => n >= 1000000 ? (n/1000000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : (n||0).toString();
const fmtMoney = n => `$${(n||0).toFixed(2)}`;

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "var(--accent)", trend }) {
  return (
    <div style={{ background:"var(--surface)", borderRadius:16, padding:16, border:"1px solid var(--border)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ background:`${color}22`, borderRadius:10, padding:8, marginBottom:10 }}>
          <Icon size={18} color={color} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize:11, color: trend >= 0 ? "#22c55e" : "#ef4444", background: trend >= 0 ? "#22c55e22" : "#ef444422", padding:"2px 6px", borderRadius:20 }}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div style={{ fontSize:22, fontWeight:800, color:"var(--text)" }}>{value}</div>
      <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ─── CREATOR STUDIO SCREEN ────────────────────────────────────────────────────
export function CreatorStudioScreen() {
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const nav = useNavigate();
  const { user } = useStore();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [a, e] = await Promise.all([
        apiFetch(`/creator/analytics?period=${period}`),
        apiFetch(`/creator/earnings?period=${period}`)
      ]);
      setAnalytics(a);
      setEarnings(e);
      setLoading(false);
    };
    load();
  }, [period]);

  const tabs = ["overview", "analytics", "earnings", "subscribers", "brand deals"];

  return (
    <div style={{ fontFamily:"var(--font)", minHeight:"100vh", background:"var(--bg)" }}>
      {/* Header */}
      <div style={{ padding:"16px 16px 0", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(10px)", zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)", padding:0 }}><ArrowLeft size={20} /></button>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18 }}>Creator Studio</div>
            <div style={{ fontSize:12, color:"var(--text2)" }}>@{user?.username}</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {["7d","30d","90d"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ background: period===p ? "var(--accent)" : "var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"4px 10px", fontSize:12, cursor:"pointer", color: period===p ? "#fff" : "var(--text)", fontFamily:"var(--font)" }}>{p}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:0, overflowX:"auto", paddingBottom:0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background:"none", border:"none", borderBottom: tab===t ? "2px solid var(--accent)" : "2px solid transparent", padding:"10px 14px", color: tab===t ? "var(--accent)" : "var(--text2)", fontSize:13, fontWeight: tab===t ? 700 : 400, cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap", textTransform:"capitalize" }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:16 }}>
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:16 }} />)}
          </div>
        ) : tab === "overview" ? (
          <OverviewTab analytics={analytics} earnings={earnings} nav={nav} />
        ) : tab === "analytics" ? (
          <AnalyticsTab data={analytics} />
        ) : tab === "earnings" ? (
          <EarningsTab data={earnings} />
        ) : tab === "subscribers" ? (
          <SubscribersTab />
        ) : (
          <BrandDealsTab />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analytics, earnings, nav }) {
  const ps = analytics?.post_stats || {};
  const s = earnings?.summary || {};
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Revenue cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <StatCard icon={DollarSign} label="Monthly Revenue" value={fmtMoney(s.total_net)} color="#22c55e" trend={12} />
        <StatCard icon={Users} label="Subscribers" value={fmtNum(analytics?.follower_count)} color="var(--accent)" trend={5} />
        <StatCard icon={Eye} label="Reach" value={fmtNum(analytics?.reach_estimate)} color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Eng. Rate" value={`${analytics?.engagement_rate || 0}%`} color="#8b5cf6" trend={2} />
      </div>

      {/* Quick actions */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { icon:Zap, label:"AI Studio", desc:"Generate captions & hashtags", color:"#f59e0b", path:"/ai-studio" },
          { icon:Radio, label:"Go Live", desc:"Start a live stream now", color:"#ef4444", path:"/live/studio" },
          { icon:ShoppingBag, label:"My Shop", desc:"Manage products & orders", color:"#22c55e", path:"/shop/manage" },
          { icon:Gift, label:"Set Up Tips", desc:"Let fans support you", color:"#8b5cf6", path:"/monetize" },
        ].map(({ icon:Icon, label, desc, color, path }) => (
          <button key={label} onClick={() => nav(path)} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:14, cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ background:`${color}22`, borderRadius:8, padding:6, width:"fit-content" }}>
              <Icon size={16} color={color} />
            </div>
            <div style={{ fontWeight:700, fontSize:13, color:"var(--text)" }}>{label}</div>
            <div style={{ fontSize:11, color:"var(--text2)" }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* Top posts */}
      {analytics?.top_posts?.length > 0 && (
        <div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>🏆 Top Performing Posts</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {analytics.top_posts.slice(0,3).map((p, i) => (
              <div key={p.id} style={{ background:"var(--surface)", borderRadius:12, padding:12, display:"flex", alignItems:"center", gap:12, border:"1px solid var(--border)" }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"var(--text2)", flexShrink:0 }}>#{i+1}</div>
                <img src={p.image_url || `https://picsum.photos/seed/${p.id}/80/80`} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:"cover", flexShrink:0 }} onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/80/80`; }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:"var(--text)", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.caption || "No caption"}</div>
                  <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>❤️ {fmtNum(p.likes_count)} · 💬 {fmtNum(p.comments_count)} · 👁️ {fmtNum(p.views_count)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({ data }) {
  const ps = data?.post_stats || {};
  const growth = data?.follower_growth || [];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <StatCard icon={Heart} label="Total Likes" value={fmtNum(ps.total_likes)} color="#ef4444" />
        <StatCard icon={Eye} label="Total Views" value={fmtNum(ps.total_views)} color="#3b82f6" />
        <StatCard icon={BarChart3} label="Avg Likes/Post" value={fmtNum(Math.round(ps.avg_likes))} color="#22c55e" />
        <StatCard icon={Users} label="Avg Comments" value={fmtNum(Math.round(ps.avg_comments))} color="#f59e0b" />
      </div>

      {/* Audience breakdown */}
      {data?.audience && (
        <div style={{ background:"var(--surface)", borderRadius:16, padding:16, border:"1px solid var(--border)" }}>
          <div style={{ fontWeight:700, marginBottom:12 }}>👥 Audience Demographics</div>
          <div style={{ fontSize:13, color:"var(--text2)", marginBottom:8 }}>Gender</div>
          {data.audience.gender.map(g => (
            <div key={g.label} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12 }}>{g.label}</span>
                <span style={{ fontSize:12, fontWeight:700 }}>{g.value}%</span>
              </div>
              <div style={{ height:6, background:"var(--border)", borderRadius:3 }}>
                <div style={{ height:"100%", width:`${g.value}%`, background:"var(--accent)", borderRadius:3 }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize:13, color:"var(--text2)", marginTop:12, marginBottom:8 }}>Age Groups</div>
          <div style={{ display:"flex", gap:6 }}>
            {data.audience.age.map(a => (
              <div key={a.range} style={{ flex:1, textAlign:"center" }}>
                <div style={{ height:60, background:"var(--border)", borderRadius:6, display:"flex", alignItems:"flex-end", overflow:"hidden" }}>
                  <div style={{ width:"100%", height:`${a.value}%`, background:"var(--accent)", borderRadius:4 }} />
                </div>
                <div style={{ fontSize:9, color:"var(--text3)", marginTop:4 }}>{a.range}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsTab({ data }) {
  const s = data?.summary || {};
  const [payingOut, setPayingOut] = useState(false);
  const [result, setResult] = useState(null);

  const requestPayout = async () => {
    setPayingOut(true);
    const r = await apiFetch("/creator/payout", { method:"POST" });
    setResult(r);
    setPayingOut(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:"linear-gradient(135deg, #22c55e22, #16a34a22)", borderRadius:20, padding:20, border:"1px solid #22c55e33" }}>
        <div style={{ fontSize:13, color:"#22c55e", marginBottom:4 }}>Available Balance</div>
        <div style={{ fontSize:36, fontWeight:900, color:"var(--text)" }}>{fmtMoney(data?.pending_balance)}</div>
        <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>Min payout $50 · 3-5 business days</div>
        <button onClick={requestPayout} disabled={payingOut || (data?.pending_balance || 0) < 50} style={{ marginTop:12, background:"#22c55e", border:"none", borderRadius:12, padding:"10px 20px", color:"#fff", fontWeight:700, cursor:"pointer", opacity: (data?.pending_balance || 0) < 50 ? 0.5 : 1 }}>
          {payingOut ? "Processing…" : "Request Payout"}
        </button>
        {result?.error && <div style={{ color:"#ef4444", fontSize:12, marginTop:8 }}>{result.error}</div>}
        {result?.success && <div style={{ color:"#22c55e", fontSize:12, marginTop:8 }}>✅ Payout requested! ETA: {result.eta}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <StatCard icon={DollarSign} label="This Period" value={fmtMoney(s.total_net)} color="#22c55e" />
        <StatCard icon={TrendingUp} label="Total Paid Out" value={fmtMoney(data?.total_paid_out)} color="#3b82f6" />
        <StatCard icon={Users} label="From Subscribers" value={fmtMoney(s.subscription_earnings)} color="#8b5cf6" />
        <StatCard icon={Gift} label="From Tips" value={fmtMoney(s.tip_earnings)} color="#f59e0b" />
      </div>

      {/* Revenue breakdown bar */}
      <div style={{ background:"var(--surface)", borderRadius:16, padding:16, border:"1px solid var(--border)" }}>
        <div style={{ fontWeight:700, marginBottom:12 }}>Revenue Breakdown</div>
        {[
          { label:"Subscriptions", value:s.subscription_earnings, color:"#8b5cf6" },
          { label:"Tips", value:s.tip_earnings, color:"#f59e0b" },
          { label:"Shop", value:s.shop_earnings, color:"#22c55e" },
          { label:"Brand Deals", value:s.brand_earnings, color:"#3b82f6" },
        ].map(item => {
          const pct = s.total_gross > 0 ? Math.round((item.value/s.total_gross)*100) : 0;
          return (
            <div key={item.label} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13 }}>{item.label}</span>
                <span style={{ fontSize:13, fontWeight:700 }}>{fmtMoney(item.value)} ({pct}%)</span>
              </div>
              <div style={{ height:6, background:"var(--border)", borderRadius:3 }}>
                <div style={{ height:"100%", width:`${pct}%`, background:item.color, borderRadius:3, transition:"width .5s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubscribersTab() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/creator/my-subscribers").then(r => { setSubs(r.subscribers || []); setLoading(false); });
  }, []);

  return (
    <div>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>My Subscribers ({subs.length})</div>
      {loading ? <div className="spinner" style={{ margin:"40px auto", display:"block" }} /> :
       subs.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>
          <Crown size={40} style={{ marginBottom:12, opacity:0.4 }} />
          <div style={{ fontWeight:700 }}>No subscribers yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Set up subscription tiers to start earning</div>
        </div>
       ) : subs.map(s => (
        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
          <img src={s.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.username}`} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover" }} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{s.name}</div>
            <div style={{ fontSize:12, color:"var(--text2)" }}>@{s.username} · {s.tier_name}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:700, color:"#22c55e" }}>{fmtMoney(s.price)}/mo</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandDealsTab() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/creator/brand-deals").then(r => { setDeals(r.deals || []); setLoading(false); });
  }, []);

  const statusColor = { offered:"#f59e0b", accepted:"#22c55e", declined:"#ef4444", completed:"#3b82f6" };

  return (
    <div>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Brand Deals</div>
      {loading ? <div className="spinner" style={{ margin:"40px auto", display:"block" }} /> :
       deals.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>
          <Award size={40} style={{ marginBottom:12, opacity:0.4 }} />
          <div style={{ fontWeight:700 }}>No brand deals yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>Brands will reach out as your audience grows</div>
        </div>
       ) : deals.map(d => (
        <div key={d.id} style={{ background:"var(--surface)", borderRadius:14, padding:14, marginBottom:10, border:"1px solid var(--border)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ fontWeight:700 }}>{d.brand_name}</div>
            <span style={{ fontSize:11, color:statusColor[d.status] || "var(--text2)", background:`${statusColor[d.status] || "var(--border)"}22`, padding:"2px 8px", borderRadius:20, textTransform:"capitalize" }}>{d.status}</span>
          </div>
          <div style={{ fontSize:13, marginBottom:6 }}>{d.title}</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#22c55e", marginBottom:8 }}>{fmtMoney(d.amount)}</div>
          {d.status === "offered" && (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => apiFetch(`/creator/brand-deals/${d.id}/accept`, { method:"POST" }).then(() => setDeals(prev => prev.map(x => x.id===d.id ? {...x, status:"accepted"} : x)))} style={{ flex:1, background:"#22c55e", border:"none", borderRadius:10, padding:"8px 0", color:"#fff", fontWeight:700, cursor:"pointer" }}>Accept</button>
              <button onClick={() => apiFetch(`/creator/brand-deals/${d.id}/decline`, { method:"POST" }).then(() => setDeals(prev => prev.map(x => x.id===d.id ? {...x, status:"declined"} : x)))} style={{ flex:1, background:"var(--border)", border:"none", borderRadius:10, padding:"8px 0", color:"var(--text)", fontWeight:700, cursor:"pointer" }}>Decline</button>
            </div>
          )}
        </div>
       ))}
    </div>
  );
}

// ─── AI STUDIO SCREEN ─────────────────────────────────────────────────────────
export function AIStudioScreen() {
  const [tab, setTab] = useState("caption");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ image_description:"", tone:"engaging", niche:"", caption:"", period:"30d" });
  const { showToast } = useStore();
  const nav = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const actions = {
    caption: () => apiFetch("/ai/caption", { method:"POST", body: JSON.stringify({ image_description:form.image_description, tone:form.tone }) }),
    hashtags: () => apiFetch("/ai/hashtags", { method:"POST", body: JSON.stringify({ caption:form.caption, niche:form.niche }) }),
    bio: () => apiFetch("/ai/bio", { method:"POST", body: JSON.stringify({ current_bio:form.bio, niche:form.niche }) }),
    "content-plan": () => apiFetch("/ai/content-plan", { method:"POST", body: JSON.stringify({ niche:form.niche }) }),
    insights: () => apiFetch("/ai/insights"),
    trends: () => apiFetch("/ai/trend-predict", { method:"POST", body: JSON.stringify({ niche:form.niche }) }),
  };

  const run = async () => {
    setLoading(true); setResult(null);
    const data = await actions[tab]?.().catch(e => ({ error: e.message }));
    setResult(data);
    setLoading(false);
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); showToast("Copied!", "success"); };

  const tabs = [
    { id:"caption", icon:Camera, label:"Captions" },
    { id:"hashtags", icon:Tag, label:"Hashtags" },
    { id:"bio", icon:Edit2, label:"Bio" },
    { id:"content-plan", icon:BarChart3, label:"Content Plan" },
    { id:"insights", icon:TrendingUp, label:"Insights" },
    { id:"trends", icon:Flame, label:"Trends" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"var(--font)" }}>
      <div style={{ padding:"16px 16px 0", position:"sticky", top:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(10px)", zIndex:20, borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)", padding:0 }}><ArrowLeft size={20} /></button>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, display:"flex", alignItems:"center", gap:6 }}>
              <Sparkles size={18} color="#f59e0b" /> AI Studio
            </div>
            <div style={{ fontSize:12, color:"var(--text2)" }}>AI-powered content tools</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:0, overflowX:"auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }} style={{ background:"none", border:"none", borderBottom: tab===t.id ? "2px solid #f59e0b" : "2px solid transparent", padding:"10px 12px", color: tab===t.id ? "#f59e0b" : "var(--text2)", fontSize:12, fontWeight: tab===t.id ? 700 : 400, cursor:"pointer", fontFamily:"var(--font)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:16 }}>
        {/* Input form by tab */}
        <div style={{ background:"var(--surface)", borderRadius:16, padding:16, marginBottom:16, border:"1px solid var(--border)" }}>
          {tab === "caption" && <>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:8 }}>Describe your image or video</div>
            <textarea value={form.image_description} onChange={set("image_description")} placeholder="A sunset photo at the beach with golden hour lighting, lifestyle vibe…" className="input" style={{ resize:"none", height:80, width:"100%", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Tone</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["engaging","inspirational","humorous","professional","personal"].map(t => (
                <button key={t} onClick={() => setForm(f=>({...f, tone:t}))} style={{ background: form.tone===t ? "var(--accent)" : "var(--border)", border:"none", borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", color: form.tone===t ? "#fff" : "var(--text)", fontFamily:"var(--font)" }}>{t}</button>
              ))}
            </div>
          </>}
          {(tab === "hashtags" || tab === "content-plan" || tab === "trends" || tab === "bio") && <>
            {tab === "hashtags" && <><div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Your caption</div><input value={form.caption} onChange={set("caption")} placeholder="Add your caption here…" className="input" style={{ marginBottom:10 }} /></>}
            {tab === "bio" && <><div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Current bio</div><input value={form.bio} onChange={set("bio")} placeholder="Your current bio…" className="input" style={{ marginBottom:10 }} /></>}
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Your niche</div>
            <input value={form.niche} onChange={set("niche")} placeholder="e.g. fitness, food, travel, tech…" className="input" />
          </>}
          {(tab === "insights") && <div style={{ fontSize:13, color:"var(--text2)" }}>Get personalized growth insights based on your account performance</div>}
        </div>

        <button onClick={run} disabled={loading} style={{ width:"100%", background:"linear-gradient(135deg, #f59e0b, #ef4444)", border:"none", borderRadius:14, padding:"14px 0", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:20, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }} /> Generating…</> : <><Wand2 size={16} /> Generate with AI</>}
        </button>

        {/* Results */}
        {result && !result.error && <AIResults tab={tab} result={result} copyText={copyText} />}
        {result?.error && <div style={{ background:"#ef444422", border:"1px solid #ef4444", borderRadius:12, padding:16, color:"#ef4444", fontSize:13 }}>⚠️ {result.error}</div>}
      </div>
    </div>
  );
}

function AIResults({ tab, result, copyText }) {
  if (tab === "caption" && result.captions) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {result.captions.map((c, i) => (
          <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700, textTransform:"uppercase" }}>Option {i+1} · {c.tone}</span>
              <button onClick={() => copyText(c.text)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}><Copy size={14} /></button>
            </div>
            <div style={{ fontSize:14, lineHeight:1.6, marginBottom:8 }}>{c.text}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>🪝 {c.hook}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>📣 {c.cta}</div>
          </div>
        ))}
        {result.best_time_to_post && <div style={{ background:"#f59e0b22", borderRadius:12, padding:12, fontSize:13, color:"#f59e0b" }}>⏰ Best time to post: {result.best_time_to_post}</div>}
      </div>
    );
  }

  if (tab === "hashtags" && result.hashtags) {
    const h = result.hashtags;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {Object.entries(h).map(([key, tags]) => (
          <div key={key} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:700, textTransform:"capitalize" }}>{key} Tags</span>
              <button onClick={() => copyText(tags.map(t => `#${t.replace(/^#/,"")}`).join(" "))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}><Copy size={14} /></button>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {(Array.isArray(tags) ? tags : []).map(t => (
                <span key={t} style={{ background:"var(--accent)22", border:"1px solid var(--accent)44", borderRadius:20, padding:"3px 10px", fontSize:12, color:"var(--accent)" }}>#{t.replace(/^#/,"")}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "insights" && result.insights) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:"var(--surface)", borderRadius:14, padding:16, border:"1px solid var(--border)", textAlign:"center" }}>
          <div style={{ fontSize:48, fontWeight:900, color: result.grade==="A" ? "#22c55e" : result.grade==="B" ? "#f59e0b" : "#ef4444" }}>{result.grade}</div>
          <div style={{ fontSize:13, color:"var(--text2)" }}>Account Score: {result.score}/100</div>
          <div style={{ fontSize:12, color:"var(--text3)", marginTop:6 }}>{result.growth_potential}</div>
        </div>
        {result.insights.map((ins, i) => (
          <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:`1px solid ${ins.priority==="high"?"#ef4444":ins.priority==="medium"?"#f59e0b":"var(--border)"}44` }}>
            <div style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
              <span style={{ fontSize:10, color: ins.priority==="high"?"#ef4444":ins.priority==="medium"?"#f59e0b":"var(--text3)", background: ins.priority==="high"?"#ef444422":ins.priority==="medium"?"#f59e0b22":"var(--border)", padding:"2px 8px", borderRadius:20, textTransform:"uppercase", fontWeight:700 }}>{ins.priority}</span>
              <span style={{ fontSize:13, fontWeight:700 }}>{ins.title}</span>
            </div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>{ins.description}</div>
            <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600 }}>→ {ins.action}</div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "content-plan" && result.plan) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {result.plan.map((day, i) => (
          <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{day.day}</span>
              <span style={{ fontSize:11, color:"var(--text2)", background:"var(--border)", padding:"2px 8px", borderRadius:20 }}>{day.format}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--accent)", marginBottom:4 }}>{day.theme}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginBottom:4 }}>🪝 {day.hook}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>⏰ {day.best_time}</div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "trends" && result.trends) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {result.trends?.map((t, i) => (
          <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontWeight:700 }}>{t.topic}</span>
              <span style={{ fontWeight:800, color:"#ef4444" }}>{t.opportunity_score}/100 🔥</span>
            </div>
            <div style={{ fontSize:12, color:"var(--text2)", marginBottom:6 }}>{t.why_trending}</div>
            <div style={{ fontSize:12, color:"var(--accent)" }}>Angle: {t.content_angle}</div>
            {t.time_sensitive && <div style={{ fontSize:11, color:"#f59e0b", marginTop:4 }}>⚡ Time sensitive · {t.expected_duration}</div>}
          </div>
        ))}
      </div>
    );
  }

  if (tab === "bio" && result.bios) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {result.bios.map((b, i) => (
          <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700 }}>Option {i+1}</span>
              <button onClick={() => copyText(b.text)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}><Copy size={14} /></button>
            </div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>{b.text}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>{b.strategy}</div>
          </div>
        ))}
      </div>
    );
  }

  return <div style={{ background:"var(--surface)", borderRadius:14, padding:14, fontSize:13, color:"var(--text2)" }}>Result: {JSON.stringify(result, null, 2)}</div>;
}

// ─── LIVE STUDIO SCREEN ───────────────────────────────────────────────────────
export function LiveStudioScreen() {
  const [step, setStep] = useState("setup"); // setup | live | ended
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [session, setSession] = useState(null);
  const [chatMsg, setChatMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user, showToast } = useStore();
  const nav = useNavigate();
  const chatEnd = useRef(null);

  const goLive = async () => {
    if (!title.trim()) return showToast("Add a title!", "error");
    setLoading(true);
    const data = await apiFetch("/live/start", { method:"POST", body: JSON.stringify({ title, category }) });
    if (data.success) {
      setSession(data.session);
      setStep("live");
    } else {
      showToast(data.error || "Failed to go live", "error");
    }
    setLoading(false);
  };

  const endLive = async () => {
    await apiFetch("/live/end", { method:"POST" });
    setStep("ended");
    showToast("Stream ended!", "success");
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || !session) return;
    const data = await apiFetch(`/live/session/${session.id}/chat`, { method:"POST", body: JSON.stringify({ message: chatMsg }) });
    if (data.chat) { setChat(c => [...c, data.chat]); setChatMsg(""); chatEnd.current?.scrollIntoView(); }
  };

  const categories = ["general","gaming","music","art","fitness","cooking","education","travel"];

  return (
    <div style={{ minHeight:"100vh", background:"#000", fontFamily:"var(--font)", color:"#fff" }}>
      {step === "setup" && (
        <div style={{ padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
            <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"#fff" }}><ArrowLeft size={20} /></button>
            <div style={{ fontWeight:800, fontSize:18, display:"flex", alignItems:"center", gap:6 }}>
              <Radio size={18} color="#ef4444" /> Go Live
            </div>
          </div>

          {/* Camera preview placeholder */}
          <div style={{ width:"100%", aspectRatio:"9/16", background:"#111", borderRadius:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", marginBottom:20, border:"1px solid #333", maxHeight:400, overflow:"hidden" }}>
            <Video size={48} color="#333" style={{ marginBottom:12 }} />
            <div style={{ color:"#555", fontSize:14 }}>Camera preview</div>
            <div style={{ color:"#333", fontSize:12, marginTop:4 }}>Connect streaming software via RTMP</div>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, color:"#aaa", marginBottom:6 }}>Stream Title</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you streaming today?" style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:14, fontFamily:"var(--font)", boxSizing:"border-box" }} />
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, color:"#aaa", marginBottom:6 }}>Category</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ background: category===c ? "#ef4444" : "#111", border:`1px solid ${category===c?"#ef4444":"#333"}`, borderRadius:20, padding:"6px 14px", fontSize:12, color:"#fff", cursor:"pointer", fontFamily:"var(--font)", textTransform:"capitalize" }}>{c}</button>
              ))}
            </div>
          </div>

          <button onClick={goLive} disabled={loading} style={{ width:"100%", background:"#ef4444", border:"none", borderRadius:14, padding:"16px 0", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {loading ? "Starting…" : <><Radio size={18} /> Go Live Now</>}
          </button>
        </div>
      )}

      {step === "live" && session && (
        <div style={{ height:"100vh", display:"flex", flexDirection:"column" }}>
          {/* Live video area */}
          <div style={{ flex:1, background:"#0a0a0a", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ position:"absolute", top:12, left:12, display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ background:"#ef4444", borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:6, height:6, background:"#fff", borderRadius:"50%" }} />LIVE
              </div>
              <div style={{ background:"rgba(0,0,0,0.6)", borderRadius:20, padding:"4px 10px", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                <Users size={12} /> {viewerCount}
              </div>
            </div>
            <div style={{ fontSize:40, opacity:0.1 }}>📡</div>
            <div style={{ position:"absolute", top:12, right:12 }}>
              <button onClick={endLive} style={{ background:"#ef4444", border:"none", borderRadius:12, padding:"6px 14px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>End</button>
            </div>
          </div>

          {/* Chat */}
          <div style={{ height:260, background:"rgba(0,0,0,0.9)", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"8px 12px", borderBottom:"1px solid #222" }}>
              <div style={{ fontSize:13, fontWeight:700 }}>{session.title}</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
              {chat.map(m => (
                <div key={m.id} style={{ marginBottom:6, fontSize:13 }}>
                  <span style={{ fontWeight:700, color:"var(--accent)" }}>{m.user?.username}: </span>
                  <span>{m.message}</span>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div style={{ padding:8, display:"flex", gap:8 }}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key==="Enter" && sendChat()} placeholder="Say something…" style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:20, padding:"8px 14px", color:"#fff", fontSize:13, fontFamily:"var(--font)" }} />
              <button onClick={sendChat} style={{ background:"var(--accent)", border:"none", borderRadius:20, padding:"8px 14px", cursor:"pointer" }}><Send size={16} color="#fff" /></button>
            </div>
          </div>
        </div>
      )}

      {step === "ended" && (
        <div style={{ padding:40, textAlign:"center" }}>
          <div style={{ fontSize:60, marginBottom:16 }}>🎬</div>
          <div style={{ fontWeight:800, fontSize:22, marginBottom:8 }}>Stream Ended!</div>
          <div style={{ color:"#aaa", fontSize:14, marginBottom:24 }}>Great stream! Your replay will be available soon.</div>
          <button onClick={() => nav(-1)} style={{ background:"var(--accent)", border:"none", borderRadius:12, padding:"12px 24px", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Back to Home</button>
        </div>
      )}
    </div>
  );
}

// ─── LIVE DISCOVER SCREEN ─────────────────────────────────────────────────────
export function LiveDiscoverScreen() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    apiFetch("/live/active").then(r => { setSessions(r.sessions || []); setLoading(false); });
  }, []);

  return (
    <div style={{ fontFamily:"var(--font)" }}>
      <div style={{ padding:"16px 16px 12px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)" }}><ArrowLeft size={20} /></button>
        <div style={{ fontWeight:800, fontSize:18, display:"flex", alignItems:"center", gap:6 }}><Radio size={16} color="#ef4444" /> Live Now</div>
      </div>

      <div style={{ padding:14 }}>
        <button onClick={() => nav("/live/studio")} style={{ width:"100%", background:"#ef4444", border:"none", borderRadius:14, padding:"12px 0", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Radio size={16} /> Start Your Live Stream
        </button>

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ aspectRatio:"9/16", borderRadius:16 }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>
            <Radio size={40} style={{ marginBottom:12, opacity:0.3 }} />
            <div style={{ fontWeight:700 }}>Nobody's live right now</div>
            <div style={{ fontSize:13, marginTop:4 }}>Be the first to go live!</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {sessions.map(s => (
              <div key={s.id} onClick={() => nav(`/live/${s.id}`)} style={{ borderRadius:16, overflow:"hidden", background:"var(--surface)", cursor:"pointer", border:"1px solid var(--border)", position:"relative" }}>
                <div style={{ aspectRatio:"9/16", background:"#111", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <img src={s.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.username}`} alt="" style={{ width:60, height:60, borderRadius:"50%", objectFit:"cover" }} />
                </div>
                <div style={{ position:"absolute", top:8, left:8, background:"#ef4444", borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700, color:"#fff" }}>LIVE</div>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"12px 8px 8px", background:"linear-gradient(transparent, rgba(0,0,0,0.9))" }}>
                  <div style={{ fontWeight:700, fontSize:12, color:"#fff" }}>{s.username}</div>
                  <div style={{ fontSize:11, color:"#aaa", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{s.title}</div>
                  <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>👁 {fmtNum(s.viewer_count)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SHOP SCREEN (Browse products) ───────────────────────────────────────────
export function ShopBrowseScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { showToast } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    apiFetch("/shop/featured").then(r => { setProducts(r.products || []); setLoading(false); });
  }, []);

  const buyNow = async (product) => {
    const data = await apiFetch("/shop/orders", { method:"POST", body: JSON.stringify({ product_id:product.id, quantity:1 }) });
    if (data.success) showToast(`Order placed! ${data.estimated_delivery}`, "success");
    else showToast(data.error || "Order failed", "error");
    setSelected(null);
  };

  return (
    <div style={{ fontFamily:"var(--font)" }}>
      <div style={{ padding:"16px 16px 12px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(10px)", zIndex:20 }}>
        <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)" }}><ArrowLeft size={20} /></button>
        <div style={{ fontWeight:800, fontSize:18, display:"flex", alignItems:"center", gap:6 }}><ShoppingBag size={16} color="var(--accent)" /> Shop</div>
        <div style={{ marginLeft:"auto" }}>
          <button onClick={() => nav("/shop/manage")} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"6px 12px", fontSize:12, color:"var(--text)", cursor:"pointer", fontFamily:"var(--font)" }}>My Shop</button>
        </div>
      </div>

      <div style={{ padding:14 }}>
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ aspectRatio:"1", borderRadius:16 }} />)}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>
            <ShoppingBag size={40} style={{ marginBottom:12, opacity:0.3 }} />
            <div style={{ fontWeight:700 }}>No products yet</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {products.map(p => {
              const imgs = typeof p.images === "string" ? JSON.parse(p.images) : p.images;
              const img = imgs?.[0] || `https://picsum.photos/seed/${p.id}/300/300`;
              return (
                <div key={p.id} onClick={() => setSelected(p)} style={{ cursor:"pointer", borderRadius:16, overflow:"hidden", background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <img src={img} alt={p.name} style={{ width:"100%", aspectRatio:"1", objectFit:"cover" }} onError={e => { e.target.src=`https://picsum.photos/seed/${p.id}/300/300`; }} />
                  <div style={{ padding:10 }}>
                    <div style={{ fontSize:12, color:"var(--text2)", marginBottom:2 }}>@{p.username}</div>
                    <div style={{ fontWeight:600, fontSize:13, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.name}</div>
                    <div style={{ fontWeight:800, fontSize:15, color:"var(--accent)", marginTop:4 }}>${p.price}</div>
                    {p.compare_at_price > p.price && <div style={{ fontSize:11, color:"var(--text3)", textDecoration:"line-through" }}>${p.compare_at_price}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product modal */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setSelected(null)}>
          <div style={{ background:"var(--bg)", borderRadius:"20px 20px 0 0", width:"100%", padding:20, maxHeight:"80vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:18 }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)" }}><X size={20} /></button>
            </div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:12 }}>{selected.description}</div>
            <div style={{ fontSize:28, fontWeight:900, color:"var(--accent)", marginBottom:16 }}>${selected.price}</div>
            {selected.is_digital ? <div style={{ background:"#22c55e22", border:"1px solid #22c55e44", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#22c55e", marginBottom:16 }}>⚡ Digital product — instant delivery</div> : null}
            <button onClick={() => buyNow(selected)} style={{ width:"100%", background:"var(--accent)", border:"none", borderRadius:14, padding:"14px 0", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>Buy Now · ${selected.price}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MONETIZE SCREEN ──────────────────────────────────────────────────────────
export function MonetizeScreen() {
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showTier, setShowTier] = useState(false);
  const [tierForm, setTierForm] = useState({ name:"", description:"", price:"" });
  const [perks, setPerks] = useState([""]);
  const { user, showToast } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    apiFetch(`/creator/profile/${user?.username}`).then(r => {
      setIsCreator(!!r.creator);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.username]);

  const onboard = async () => {
    const data = await apiFetch("/creator/onboard", { method:"POST", body: JSON.stringify({ category:"lifestyle" }) });
    if (data.success) { setIsCreator(true); showToast("Creator account activated! 🎉", "success"); }
    else showToast(data.error || "Failed", "error");
    setShowOnboard(false);
  };

  const createTier = async () => {
    const data = await apiFetch("/creator/tiers", { method:"POST", body: JSON.stringify({ ...tierForm, price: parseFloat(tierForm.price), perks: perks.filter(Boolean) }) });
    if (data.success) { showToast("Tier created!", "success"); setShowTier(false); setTierForm({ name:"", description:"", price:"" }); }
    else showToast(data.error || "Failed", "error");
  };

  return (
    <div style={{ fontFamily:"var(--font)", minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ padding:"16px 16px 12px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => nav(-1)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)" }}><ArrowLeft size={20} /></button>
        <div style={{ fontWeight:800, fontSize:18, display:"flex", alignItems:"center", gap:6 }}><DollarSign size={16} color="#22c55e" /> Monetize</div>
      </div>

      <div style={{ padding:16 }}>
        {loading ? <div className="spinner" style={{ margin:"40px auto", display:"block" }} /> :
        !isCreator ? (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ fontSize:64, marginBottom:16 }}>💰</div>
            <div style={{ fontWeight:800, fontSize:22, marginBottom:8 }}>Turn Your Passion Into Income</div>
            <div style={{ fontSize:14, color:"var(--text2)", marginBottom:24, lineHeight:1.6 }}>Join thousands of creators earning from subscriptions, tips, and brand deals on Yor Talks.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24, textAlign:"left" }}>
              {[
                { icon:"💳", title:"Subscriptions", desc:"Monthly income from fans" },
                { icon:"🎁", title:"Tips", desc:"One-time fan support" },
                { icon:"🛍️", title:"Shop", desc:"Sell products & merch" },
                { icon:"🤝", title:"Brand Deals", desc:"Partner with brands" },
              ].map(f => (
                <div key={f.title} style={{ background:"var(--surface)", borderRadius:14, padding:14, border:"1px solid var(--border)" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{f.icon}</div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{f.title}</div>
                  <div style={{ fontSize:12, color:"var(--text2)" }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowOnboard(true)} style={{ width:"100%", background:"linear-gradient(135deg, #22c55e, #16a34a)", border:"none", borderRadius:14, padding:"14px 0", color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>
              Activate Creator Account
            </button>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:8 }}>Platform takes 20% on subscriptions · 15% on tips · 5% on shop</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button onClick={() => nav("/creator-studio")} style={{ background:"linear-gradient(135deg, #8b5cf6, #6d28d9)", border:"none", borderRadius:14, padding:16, color:"#fff", cursor:"pointer", textAlign:"left" }}>
                <BarChart3 size={20} style={{ marginBottom:8 }} />
                <div style={{ fontWeight:700, fontSize:14 }}>Creator Studio</div>
                <div style={{ fontSize:12, opacity:0.8 }}>Analytics & earnings</div>
              </button>
              <button onClick={() => nav("/ai-studio")} style={{ background:"linear-gradient(135deg, #f59e0b, #d97706)", border:"none", borderRadius:14, padding:16, color:"#fff", cursor:"pointer", textAlign:"left" }}>
                <Sparkles size={20} style={{ marginBottom:8 }} />
                <div style={{ fontWeight:700, fontSize:14 }}>AI Studio</div>
                <div style={{ fontSize:12, opacity:0.8 }}>Generate content</div>
              </button>
            </div>

            <button onClick={() => setShowTier(true)} style={{ width:"100%", background:"var(--surface)", border:"2px dashed var(--border)", borderRadius:14, padding:16, color:"var(--text)", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
              <Plus size={20} color="var(--accent)" />
              <div style={{ textAlign:"left" }}>
                <div style={{ fontWeight:700, fontSize:14 }}>Create Subscription Tier</div>
                <div style={{ fontSize:12, color:"var(--text2)" }}>Offer exclusive perks to paying subscribers</div>
              </div>
            </button>

            <button onClick={() => nav("/live")} style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:16, color:"var(--text)", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
              <Radio size={20} color="#ef4444" />
              <div style={{ textAlign:"left" }}>
                <div style={{ fontWeight:700, fontSize:14 }}>Go Live</div>
                <div style={{ fontSize:12, color:"var(--text2)" }}>Interact with your audience in real-time</div>
              </div>
            </button>

            <button onClick={() => nav("/shop/manage")} style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:16, color:"var(--text)", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
              <ShoppingBag size={20} color="#22c55e" />
              <div style={{ textAlign:"left" }}>
                <div style={{ fontWeight:700, fontSize:14 }}>Creator Shop</div>
                <div style={{ fontSize:12, color:"var(--text2)" }}>Sell products, merch & digital downloads</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Onboard modal */}
      {showOnboard && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"var(--bg)", borderRadius:20, padding:24, width:"100%", maxWidth:360 }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Activate Creator Account</div>
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>By activating, you agree to our Creator Terms and the platform fee structure.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowOnboard(false)} style={{ flex:1, background:"var(--border)", border:"none", borderRadius:12, padding:"10px 0", cursor:"pointer", color:"var(--text)", fontFamily:"var(--font)" }}>Cancel</button>
              <button onClick={onboard} style={{ flex:1, background:"#22c55e", border:"none", borderRadius:12, padding:"10px 0", cursor:"pointer", color:"#fff", fontWeight:700, fontFamily:"var(--font)" }}>Activate</button>
            </div>
          </div>
        </div>
      )}

      {/* Tier modal */}
      {showTier && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"flex-end" }}>
          <div style={{ background:"var(--bg)", borderRadius:"20px 20px 0 0", width:"100%", padding:20 }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:16 }}>New Subscription Tier</div>
            <input placeholder="Tier name (e.g. VIP, Superfan)" value={tierForm.name} onChange={e => setTierForm(f=>({...f,name:e.target.value}))} className="input" style={{ marginBottom:10 }} />
            <input placeholder="Description" value={tierForm.description} onChange={e => setTierForm(f=>({...f,description:e.target.value}))} className="input" style={{ marginBottom:10 }} />
            <input placeholder="Monthly price ($)" type="number" min="1" value={tierForm.price} onChange={e => setTierForm(f=>({...f,price:e.target.value}))} className="input" style={{ marginBottom:10 }} />
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:6 }}>Perks</div>
            {perks.map((p, i) => (
              <div key={i} style={{ display:"flex", gap:6, marginBottom:6 }}>
                <input value={p} onChange={e => setPerks(prev => prev.map((x,j) => j===i ? e.target.value : x))} placeholder={`Perk ${i+1}`} className="input" style={{ flex:1 }} />
                {perks.length > 1 && <button onClick={() => setPerks(prev => prev.filter((_,j) => j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)" }}><X size={16} /></button>}
              </div>
            ))}
            <button onClick={() => setPerks(p => [...p, ""])} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--accent)", fontSize:13, marginBottom:16, fontFamily:"var(--font)" }}>+ Add perk</button>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowTier(false)} style={{ flex:1, background:"var(--border)", border:"none", borderRadius:12, padding:"10px 0", cursor:"pointer", color:"var(--text)", fontFamily:"var(--font)" }}>Cancel</button>
              <button onClick={createTier} style={{ flex:1, background:"var(--accent)", border:"none", borderRadius:12, padding:"10px 0", cursor:"pointer", color:"#fff", fontWeight:700, fontFamily:"var(--font)" }}>Create Tier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
