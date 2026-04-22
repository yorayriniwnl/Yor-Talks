import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Lock, Globe, Trash2, Check } from "lucide-react";
import api from "../api/index.js";
import { useStore } from "../store/index.js";
import { PageHeader, GridSkeleton } from "../components/Shared.jsx";

// ─── CollectionsScreen ────────────────────────────────────────────────────────
export function CollectionsScreen() {
  const [cols,    setCols]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const { showToast } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    api.get("/collections").then(r => { setCols(r.data.collections||[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await api.post("/collections", { name: newName });
      setCols(c => [data.collection, ...c]); setNewName(""); setShowNew(false);
      showToast("Collection created!", "success");
    } catch { showToast("Failed to create", "error"); }
  };

  const del = async (e, id) => {
    e.stopPropagation();
    try { await api.delete(`/collections/${id}`); setCols(c => c.filter(x=>x.id!==id)); showToast("Deleted"); }
    catch { showToast("Failed", "error"); }
  };

  return (
    <div>
      <PageHeader title="Collections" right={<button onClick={() => setShowNew(true)} className="action-btn"><Plus size={24} color="var(--text)" /></button>} />
      {showNew && (
        <div style={{ padding:"12px 16px", background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", gap:8 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Collection name…" className="input" style={{ flex:1 }} onKeyDown={e => e.key==="Enter"&&create()} />
          <button onClick={create} className="btn-follow" style={{ padding:"8px 14px", flexShrink:0 }}><Check size={18} /></button>
          <button onClick={() => setShowNew(false)} className="btn-ghost" style={{ padding:"8px 12px", flexShrink:0 }}>✕</button>
        </div>
      )}
      {loading ? <GridSkeleton count={6} /> : cols.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🔖</div><div className="title">No collections yet</div>
          <div className="subtitle">Organize your saved posts into collections.</div>
          <button className="btn-primary" style={{ width:"auto", padding:"10px 24px", marginTop:20 }} onClick={() => setShowNew(true)}>Create Collection</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
          {cols.map(col => (
            <div key={col.id} onClick={() => nav(`/collections/${col.id}`)} style={{ cursor:"pointer", position:"relative", background:"var(--surface)" }}>
              <div style={{ aspectRatio:"1", overflow:"hidden" }}>
                {col.cover_url ? <img src={col.cover_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:42, background:"var(--surface2)" }}>🔖</div>}
              </div>
              <div style={{ padding:"10px 12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
                  {col.is_private ? <Lock size={12} color="var(--text3)" /> : <Globe size={12} color="var(--text3)" />}
                  <span style={{ fontWeight:700, fontSize:14 }}>{col.name}</span>
                </div>
                <div style={{ color:"var(--text2)", fontSize:12 }}>{col.posts_count||0} posts</div>
              </div>
              <button onClick={e => del(e,col.id)} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", border:"none", borderRadius:20, padding:"5px 7px", cursor:"pointer", display:"flex", lineHeight:0 }}><Trash2 size={14} color="#fff" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CollectionDetailScreen ───────────────────────────────────────────────────
export function CollectionDetailScreen() {
  const { colId } = useParams();
  const [col, setCol] = useState(null); const [posts, setPosts] = useState([]); const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  useEffect(() => { api.get(`/collections/${colId}`).then(r => { setCol(r.data.collection); setPosts(r.data.posts||[]); setLoading(false); }).catch(()=>setLoading(false)); }, [colId]);
  if (loading) return <div style={{ textAlign:"center", padding:40 }}><div className="spinner" /></div>;
  if (!col)    return <div className="empty-state"><div className="title">Not found</div></div>;
  return (
    <div>
      <PageHeader title={col.name} subtitle={`${posts.length} posts · ${col.is_private?"Private":"Public"}`} />
      {posts.length === 0 ? <div className="empty-state"><div className="icon">🔖</div><div className="title">No posts here yet</div></div>
        : <div className="profile-grid">{posts.map(p => (<div key={p.id} className="profile-grid-item" onClick={() => nav(`/p/${p.id}`)}><img src={p.image_url} alt="" loading="lazy" onError={e=>{ e.target.src=`https://picsum.photos/seed/${p.id}/300`; }} /></div>))}</div>
      }
    </div>
  );
}

// ─── ActivityScreen ───────────────────────────────────────────────────────────
export function ActivityScreen() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  useEffect(() => { api.get("/activity").then(r => { setItems(r.data.activity||[]); setLoading(false); }).catch(()=>setLoading(false)); }, []);
  const ago = t => { try { const s=Math.floor((Date.now()-new Date(t))/1000); if(s<60)return "now"; if(s<3600)return Math.floor(s/60)+"m"; if(s<86400)return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; } catch{return "";} };

  return (
    <div>
      <PageHeader title="Friend Activity" subtitle="What people you follow are up to" />
      {loading ? <div style={{ textAlign:"center", padding:40 }}><div className="spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="icon">👀</div><div className="title">Nothing yet</div><div className="subtitle">Follow more people to see activity here.</div></div>
        : items.map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"1px solid var(--border)" }}>
            <img src={item.avatar||`https://i.pravatar.cc/44?u=${item.actor_id}`} alt="" style={{ width:44,height:44,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"pointer" }} onClick={()=>nav(`/${item.username}`)} onError={e=>{e.target.src=`https://i.pravatar.cc/44?u=${item.actor_id}`;}} />
            <div style={{ flex:1, fontSize:14 }}>
              <span style={{ fontWeight:700, cursor:"pointer" }} onClick={()=>nav(`/${item.username}`)}>{item.username}</span>
              {item.type==="like"   && <span style={{ color:"var(--text2)" }}> liked a post ❤️</span>}
              {item.type==="follow" && <span style={{ color:"var(--text2)" }}> followed <span style={{ fontWeight:700, cursor:"pointer" }} onClick={()=>nav(`/${item.target_username}`)}>{item.target_username}</span> 👥</span>}
              {item.type==="post"   && <span style={{ color:"var(--text2)" }}> shared a new photo 📸</span>}
              <div style={{ color:"var(--text3)", fontSize:11, marginTop:2 }}>{ago(item.created_at)}</div>
            </div>
            {item.post_id && <img src={item.image_url} alt="" style={{ width:46,height:46,objectFit:"cover",borderRadius:6,cursor:"pointer",flexShrink:0 }} onClick={()=>nav(`/p/${item.post_id}`)} onError={e=>{e.target.src=`https://picsum.photos/seed/${item.post_id}/46`;}} />}
            {item.type==="follow" && item.target_avatar && <img src={item.target_avatar} alt="" style={{ width:46,height:46,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"pointer" }} onClick={()=>nav(`/${item.target_username}`)} />}
          </div>
        ))
      }
    </div>
  );
}

export default CollectionsScreen;
