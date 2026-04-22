import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Bookmark, Send, MoreHorizontal, ChevronLeft, ChevronRight, Edit3, Check, X, Share2, Link2, Twitter, Copy } from "lucide-react";
import { postsApi } from "../api/index.js";
import { useStore } from "../store/index.js";
import { CommentsModal, PostMenu } from "./PostCard.jsx";
import { Avatar, VerifiedBadge, PageHeader } from "./Shared.jsx";

const fmtNum = n => n >= 1000000 ? (n/1e6).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : (n||0).toString();
const timeAgo = t => { try { return new Date(t).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }); } catch { return ""; } };

export function PostDetailFull() {
  const { postId } = useParams();
  const [post,      setPost]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [mediaIdx,  setMediaIdx]  = useState(0);
  const [showCmts,  setShowCmts]  = useState(false);
  const [showMenu,  setShowMenu]  = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [caption,   setCaption]   = useState("");
  const [savingCap, setSavingCap] = useState(false);
  const { user, showToast } = useStore();
  const nav = useNavigate();

  useEffect(() => {
    postsApi.get(postId).then(r => {
      setPost(r.data.post);
      setCaption(r.data.post?.caption || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [postId]);

  const doLike = async () => {
    if (!post) return;
    const next = !post.is_liked;
    setPost(p => ({ ...p, is_liked: next, likes_count: p.likes_count + (next ? 1 : -1) }));
    try { await postsApi.like(post.id); }
    catch { setPost(p => ({ ...p, is_liked: !next, likes_count: p.likes_count + (next ? -1 : 1) })); }
  };

  const doSave = async () => {
    if (!post) return;
    const next = !post.is_saved;
    setPost(p => ({ ...p, is_saved: next }));
    showToast(next ? "Saved ✓" : "Removed from saved");
    try { await postsApi.save(post.id); }
    catch { setPost(p => ({ ...p, is_saved: !next })); }
  };

  const saveCaption = async () => {
    setSavingCap(true);
    try {
      const { data } = await postsApi.update(post.id, { caption });
      setPost(p => ({ ...p, caption: data.post.caption }));
      setEditing(false);
      showToast("Caption updated!", "success");
    } catch { showToast("Update failed", "error"); }
    setSavingCap(false);
  };

  if (loading) return (
    <div>
      <PageHeader title="Post" />
      <div style={{ display:"flex", justifyContent:"center", padding:60 }}><div className="spinner spinner-lg" /></div>
    </div>
  );
  if (!post) return (
    <div>
      <PageHeader title="Post" />
      <div className="empty-state"><div className="icon">😕</div><div className="title">Post not found</div></div>
    </div>
  );

  const media = post.media?.length ? post.media : (post.image_url ? [{ url: post.image_url }] : []);
  const isOwn = user?.id === post.user_id;
  const postUrl = `${window.location.origin}/p/${post.id}`;

  return (
    <div>
      <PageHeader
        title="Post"
        right={<button className="action-btn" onClick={() => setShowMenu(true)}><MoreHorizontal size={22} /></button>}
      />

      {/* Author */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
        <Avatar src={post.user?.avatar} userId={post.user?.id} size={38} story onClick={() => nav(`/${post.user?.username}`)} />
        <div style={{ flex:1, cursor:"pointer" }} onClick={() => nav(`/${post.user?.username}`)}>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontWeight:700, fontSize:14 }}>
            {post.user?.username}
            {post.user?.is_verified && <VerifiedBadge size={13} />}
          </div>
          {post.location && <div style={{ fontSize:11, color:"var(--text2)" }}>{post.location}</div>}
        </div>
        {!isOwn && (
          <button className="btn-follow" style={{ padding:"6px 14px", fontSize:13 }} onClick={async () => {
            const { usersApi } = await import("../api/index.js");
            await usersApi.follow(post.user?.username);
            showToast(`Following ${post.user?.username}!`, "success");
          }}>
            {post.user?.is_following ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {/* Media carousel */}
      <div style={{ position:"relative" }}>
        <img
          src={media[mediaIdx]?.url}
          alt=""
          style={{ width:"100%", aspectRatio:"1", objectFit:"cover", display:"block" }}
          onError={e => { e.target.src = `https://picsum.photos/seed/${post.id}/600`; }}
        />
        {media.length > 1 && mediaIdx > 0 && (
          <button onClick={() => setMediaIdx(i => i-1)} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <ChevronLeft size={20} color="#fff" />
          </button>
        )}
        {media.length > 1 && mediaIdx < media.length-1 && (
          <button onClick={() => setMediaIdx(i => i+1)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <ChevronRight size={20} color="#fff" />
          </button>
        )}
        {media.length > 1 && (
          <div style={{ position:"absolute", bottom:10, left:0, right:0, display:"flex", justifyContent:"center", gap:6 }}>
            {media.map((_,i) => <div key={i} style={{ width: i===mediaIdx?20:7, height:7, borderRadius:4, background: i===mediaIdx?"#fff":"rgba(255,255,255,0.45)", transition:"width .2s", cursor:"pointer" }} onClick={() => setMediaIdx(i)} />)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding:"10px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <button className="action-btn" onClick={doLike}>
              <Heart size={28} color={post.is_liked?"#ff3040":"var(--text)"} fill={post.is_liked?"#ff3040":"none"} />
            </button>
            <button className="action-btn" onClick={() => setShowCmts(true)}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button className="action-btn" onClick={() => setShowShare(true)}>
              <Send size={26} />
            </button>
          </div>
          <button className="action-btn" onClick={doSave}>
            <Bookmark size={26} fill={post.is_saved?"var(--text)":"none"} />
          </button>
        </div>

        {/* Likes */}
        <button onClick={() => nav(`/p/${post.id}/likes`)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text)", fontWeight:700, fontSize:14, padding:0, marginBottom:8 }}>
          {fmtNum(post.likes_count)} likes
        </button>

        {/* Caption */}
        {editing ? (
          <div style={{ marginBottom:10 }}>
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)}
              rows={4}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontSize:14, padding:"10px 12px", outline:"none", resize:"none", fontFamily:"var(--font)" }}
            />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={saveCaption} disabled={savingCap}>{savingCap?"Saving…":"Save"}</button>
              <button className="btn-ghost" style={{ flex:1 }} onClick={() => { setEditing(false); setCaption(post.caption||""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize:14, lineHeight:1.6, marginBottom:8 }}>
            <span style={{ fontWeight:700, cursor:"pointer" }} onClick={() => nav(`/${post.user?.username}`)}>{post.user?.username}</span>
            {" "}{post.caption}
            {isOwn && (
              <button onClick={() => setEditing(true)} style={{ background:"none", border:"none", cursor:"pointer", marginLeft:8, padding:2 }}>
                <Edit3 size={13} color="var(--text3)" />
              </button>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
            {post.tags.map(t => <span key={t} onClick={() => nav(`/hashtag/${t}`)} style={{ color:"var(--accent)", fontSize:13, cursor:"pointer" }}>#{t}</span>)}
          </div>
        )}

        {/* Comments link */}
        {post.comments_count > 0 && (
          <button onClick={() => setShowCmts(true)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", fontSize:14, padding:0, marginBottom:6 }}>
            View all {fmtNum(post.comments_count)} comments
          </button>
        )}

        {/* Date */}
        <div style={{ fontSize:11, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.04em" }}>
          {timeAgo(post.created_at)}
        </div>
      </div>

      {/* Comments modal */}
      {showCmts && (
        <CommentsModal
          post={post}
          onClose={() => setShowCmts(false)}
          onAdded={() => setPost(p => ({ ...p, comments_count: p.comments_count + 1 }))}
        />
      )}

      {/* Post menu */}
      {showMenu && (
        <PostMenu
          post={post}
          onClose={() => setShowMenu(false)}
          onDelete={() => { setShowMenu(false); nav(-1); }}
        />
      )}

      {/* Share sheet */}
      {showShare && (
        <div className="modal-overlay" onClick={() => setShowShare(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ padding:"12px 20px 4px", fontWeight:700, fontSize:16 }}>Share post</div>
            {[
              { icon:"🔗", label:"Copy link", action: () => { navigator.clipboard.writeText(postUrl); showToast("Link copied!"); setShowShare(false); } },
              { icon:"📱", label:"Share to stories", action: () => { showToast("Added to story! ✨", "success"); setShowShare(false); } },
              { icon:"✉️", label:"Send as message", action: () => { nav("/messages"); setShowShare(false); } },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 20px", background:"none", border:"none", borderBottom:"1px solid var(--border)", cursor:"pointer", fontFamily:"var(--font)", color:"var(--text)", fontSize:15 }}>
                <span style={{ fontSize:22 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <button onClick={() => setShowShare(false)} style={{ display:"block", width:"100%", padding:"14px 20px", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font)", color:"var(--text2)", fontSize:15 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PostDetailFull;
