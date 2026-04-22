import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";
import { postsApi, storiesApi } from "../api/index.js";
import { useStore } from "../store/index.js";
import { formatDistanceToNowStrict } from "date-fns";

export const fmtNum = n => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":(n||0).toString();
const timeAgo = t => { try { return formatDistanceToNowStrict(new Date(t)); } catch { return ""; } };

// ── PostCard ──────────────────────────────────────────────────────────────────
export function PostCard({ post: init, onDelete }) {
  const [post,setPost]      = useState(init);
  const [cmts,setCmts]      = useState(false);
  const [menu,setMenu]      = useState(false);
  const [full,setFull]      = useState(false);
  const [pop,setPop]        = useState(false);
  const [mIdx,setMIdx]      = useState(0);
  const lastTap             = useRef(0);
  const { user, showToast } = useStore();
  const nav                 = useNavigate();

  const media = post.media?.length ? post.media : post.image_url ? [{ url:post.image_url }] : [];

  const doLike = async () => {
    const n = !post.is_liked;
    setPost(p => ({...p, is_liked:n, likes_count:p.likes_count+(n?1:-1)}));
    if (n) { setPop(true); setTimeout(()=>setPop(false),800); }
    try { await postsApi.like(post.id); }
    catch { setPost(p => ({...p, is_liked:!n, likes_count:p.likes_count+(n?-1:1)})); }
  };

  const doSave = async () => {
    const n = !post.is_saved;
    setPost(p => ({...p, is_saved:n}));
    showToast(n?"Saved ✓":"Removed from saved");
    try { await postsApi.save(post.id); }
    catch { setPost(p => ({...p, is_saved:!n})); }
  };

  const dblTap = () => {
    const now = Date.now();
    if (now-lastTap.current<320 && !post.is_liked) doLike();
    lastTap.current = now;
  };

  const cap  = post.caption||"";
  const long = cap.length > 110;

  return (
    <article className="post-card fade-in">
      {/* Header */}
      <div className="post-header">
        <div className="post-user" onClick={()=>nav(`/${post.user?.username}`)}>
          <div style={{width:36,height:36,borderRadius:"50%",padding:2,background:"var(--gradient)",flexShrink:0}}>
            <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"var(--bg)",padding:2}}>
              <img src={post.user?.avatar} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}
                onError={e=>{e.target.src=`https://i.pravatar.cc/36?u=${post.user?.id}`;}}/>
            </div>
          </div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontWeight:700,fontSize:14}}>{post.user?.username}</span>
              {post.user?.is_verified && <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0095f6"/><path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            {post.location && <div style={{fontSize:11,color:"var(--text2)"}}>{post.location}</div>}
          </div>
        </div>
        <button className="action-btn" onClick={()=>setMenu(true)}><MoreHorizontal size={20} color="var(--text2)"/></button>
      </div>

      {/* Media */}
      <div style={{position:"relative",userSelect:"none"}} onClick={dblTap}>
        {media.length>0
          ? <img src={media[mIdx]?.url} alt="" loading="lazy" style={{width:"100%",aspectRatio:"1",objectFit:"cover",display:"block"}} onError={e=>{e.target.src=`https://picsum.photos/seed/${post.id}/600`;}}/>
          : <div style={{width:"100%",aspectRatio:"1",background:"var(--surface)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:40,opacity:.3}}>🖼️</span></div>
        }
        {pop && <div className="heart-pop">❤️</div>}
        {media.length>1 && mIdx>0 && <button onClick={e=>{e.stopPropagation();setMIdx(i=>i-1);}} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronLeft size={18} color="#fff"/></button>}
        {media.length>1 && mIdx<media.length-1 && <button onClick={e=>{e.stopPropagation();setMIdx(i=>i+1);}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronRight size={18} color="#fff"/></button>}
        {media.length>1 && <div style={{position:"absolute",bottom:10,left:0,right:0,display:"flex",justifyContent:"center",gap:5}}>{media.map((_,i)=><div key={i} onClick={e=>{e.stopPropagation();setMIdx(i);}} style={{width:i===mIdx?18:6,height:6,borderRadius:3,background:i===mIdx?"#fff":"rgba(255,255,255,0.5)",transition:"width .2s",cursor:"pointer"}}/>)}</div>}
      </div>

      {/* Actions */}
      <div style={{padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <button className="action-btn" onClick={doLike}><Heart size={26} color={post.is_liked?"#ff3040":"var(--text)"} fill={post.is_liked?"#ff3040":"none"}/></button>
            <button className="action-btn" onClick={()=>setCmts(true)}><MessageCircle size={26} color="var(--text)"/></button>
            <button className="action-btn"><Send size={26} color="var(--text)"/></button>
          </div>
          <button className="action-btn" onClick={doSave}><Bookmark size={26} color="var(--text)" fill={post.is_saved?"var(--text)":"none"}/></button>
        </div>
        <button onClick={()=>nav(`/p/${post.id}/likes`)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text)",fontWeight:700,fontSize:14,padding:0,marginBottom:5}}>{fmtNum(post.likes_count)} likes</button>
        <div style={{fontSize:14,lineHeight:1.55,marginBottom:4}}>
          <span style={{fontWeight:700,cursor:"pointer"}} onClick={()=>nav(`/${post.user?.username}`)}>{post.user?.username}</span>{" "}
          <span>{!long||full?cap:cap.slice(0,110)}{long&&!full&&<span onClick={()=>setFull(true)} style={{color:"var(--text2)",cursor:"pointer"}}>… more</span>}</span>
        </div>
        {post.comments_count>0 && <button onClick={()=>setCmts(true)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:14,padding:0,marginBottom:4}}>View all {fmtNum(post.comments_count)} comments</button>}
        <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{timeAgo(post.created_at)} ago</div>
      </div>

      {cmts && <CommentsModal post={post} onClose={()=>setCmts(false)} onAdded={()=>setPost(p=>({...p,comments_count:p.comments_count+1}))}/>}
      {menu && <PostMenu post={post} onClose={()=>setMenu(false)} onDelete={()=>{setMenu(false);onDelete?.(post.id);}}/>}
    </article>
  );
}

// ── CommentsModal ─────────────────────────────────────────────────────────────
export function CommentsModal({ post, onClose, onAdded }) {
  const [comments,setComments]=useState([]);
  const [loading,setLoading]  =useState(true);
  const [txt,setTxt]          =useState("");
  const [sending,setSending]  =useState(false);
  const [replyTo,setReplyTo]  =useState(null);
  const { user }              = useStore();
  const botRef                = useRef(null);
  const nav                   = useNavigate();

  useEffect(()=>{
    postsApi.comments(post.id).then(r=>{setComments(r.data.items||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[post.id]);

  const send = async()=>{
    if(!txt.trim()||sending) return;
    setSending(true);
    try {
      const {data}=await postsApi.addComment(post.id,txt,replyTo?.id||null);
      setComments(c=>[...c,data.comment]);
      setTxt("");setReplyTo(null);onAdded?.();
      setTimeout(()=>botRef.current?.scrollIntoView({behavior:"smooth"}),80);
    } catch {}
    setSending(false);
  };

  return (
    <div className="modal" style={{zIndex:500}}>
      <div style={{display:"flex",alignItems:"center",padding:"14px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={onClose} className="action-btn" style={{marginRight:14}}><ArrowLeft size={24}/></button>
        <span style={{fontWeight:700,fontSize:17}}>Comments</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 12px"}}>
        <div style={{display:"flex",gap:10,marginBottom:18,paddingBottom:16,borderBottom:"1px solid var(--border)"}}>
          <img src={post.user?.avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",flexShrink:0}} onError={e=>{e.target.src=`https://i.pravatar.cc/34?u=${post.user?.id}`;}}/>
          <div><span style={{fontWeight:700,fontSize:14}}>{post.user?.username}</span>{" "}<span style={{fontSize:14}}>{post.caption}</span><div style={{color:"var(--text3)",fontSize:11,marginTop:4}}>{timeAgo(post.created_at)} ago</div></div>
        </div>
        {loading?<div style={{textAlign:"center",padding:24}}><div className="spinner"/></div>
          :comments.length===0?<div style={{textAlign:"center",padding:32,color:"var(--text2)",fontSize:14}}>No comments yet. Be the first!</div>
          :comments.map(c=>(
            <div key={c.id} style={{display:"flex",gap:10,marginBottom:16}}>
              <img src={c.user?.avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:"pointer"}} onClick={()=>nav(`/${c.user?.username}`)} onError={e=>{e.target.src=`https://i.pravatar.cc/34?u=${c.user?.id}`;}}/>
              <div style={{flex:1}}>
                <span style={{fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>nav(`/${c.user?.username}`)}>{c.user?.username}</span>{" "}<span style={{fontSize:14}}>{c.text}</span>
                <div style={{display:"flex",gap:12,marginTop:5,alignItems:"center"}}>
                  <span style={{color:"var(--text3)",fontSize:11}}>{timeAgo(c.created_at)}</span>
                  {c.likes_count>0&&<span style={{color:"var(--text2)",fontSize:11}}>{c.likes_count} likes</span>}
                  <button onClick={()=>setReplyTo(c)} style={{background:"none",border:"none",color:"var(--text2)",fontSize:11,cursor:"pointer",fontFamily:"var(--font)",fontWeight:600,padding:0}}>Reply</button>
                </div>
                {c.top_replies?.slice(0,2).map(r=>(
                  <div key={r.id} style={{display:"flex",gap:8,marginTop:10}}>
                    <img src={r.user?.avatar} alt="" style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",flexShrink:0}} onError={e=>{e.target.src=`https://i.pravatar.cc/26?u=${r.user?.id}`;}}/>
                    <div style={{fontSize:13}}><span style={{fontWeight:700}}>{r.user?.username}</span>{" "}{r.text}</div>
                  </div>
                ))}
              </div>
              <Heart size={12} color="var(--text3)" style={{marginTop:6,flexShrink:0,cursor:"pointer"}}/>
            </div>
          ))
        }
        <div ref={botRef}/>
      </div>
      {replyTo&&<div style={{padding:"8px 14px",background:"var(--surface)",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"var(--text2)",flexShrink:0}}>
        <span>Replying to <strong>{replyTo.user?.username}</strong></span>
        <button onClick={()=>setReplyTo(null)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={14} color="var(--text2)"/></button>
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <img src={user?.avatar} alt="" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",flexShrink:0}} onError={e=>{e.target.src=`https://i.pravatar.cc/32?u=${user?.id}`;}}/>
        <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder={replyTo?`Reply to ${replyTo.user?.username}…`:"Add a comment…"} style={{flex:1,background:"none",border:"none",color:"var(--text)",fontSize:14,outline:"none",fontFamily:"var(--font)"}} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
        <button onClick={send} disabled={!txt.trim()||sending} style={{background:"none",border:"none",color:txt.trim()?"var(--accent)":"var(--text3)",fontWeight:700,fontSize:14,cursor:txt.trim()?"pointer":"default",fontFamily:"var(--font)"}}>{sending?"…":"Post"}</button>
      </div>
    </div>
  );
}

// ── PostMenu ──────────────────────────────────────────────────────────────────
export function PostMenu({ post, onClose, onDelete }) {
  const { user, showToast } = useStore();
  const isOwn = user?.id === post.user_id || user?.id === post.user?.id;
  const nav   = useNavigate();
  const items = isOwn
    ? [{label:"Edit",action:()=>nav(`/p/${post.id}`)},{label:"Archive",action:async()=>{await postsApi.archive(post.id);onDelete?.();showToast("Archived");}},{label:"Delete",color:"var(--danger)",action:async()=>{await postsApi.delete(post.id);onDelete?.();showToast("Deleted");}},{label:"Copy link",action:()=>{navigator.clipboard.writeText(`${location.origin}/p/${post.id}`);showToast("Copied!");}},]
    : [{label:"Report",color:"var(--danger)",action:async()=>{await postsApi.report(post.id,"spam");showToast("Reported");}},{label:"Not interested",action:()=>onDelete?.(post.id)},{label:"Copy link",action:()=>{navigator.clipboard.writeText(`${location.origin}/p/${post.id}`);showToast("Copied!");}},{label:"Go to profile",action:()=>nav(`/${post.user?.username}`)},];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-handle"/>
        {items.map(item=><button key={item.label} onClick={async()=>{try{await item.action();}catch{showToast("Failed","error");}onClose();}} style={{display:"block",width:"100%",padding:"15px 20px",background:"none",border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer",fontFamily:"var(--font)",fontSize:15,color:item.color||"var(--text)",textAlign:"left",fontWeight:item.color?700:400}}>{item.label}</button>)}
        <button onClick={onClose} style={{display:"block",width:"100%",padding:"15px 20px",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font)",fontSize:15,color:"var(--text2)",textAlign:"center"}}>Cancel</button>
      </div>
    </div>
  );
}

// ── CreatePost ────────────────────────────────────────────────────────────────
export function CreatePost({ onClose }) {
  const [step,setStep]      =useState("pick");
  const [preview,setPreview]=useState(null);
  const [file,setFile]      =useState(null);
  const [imgUrl,setImgUrl]  =useState("");
  const [caption,setCaption]=useState("");
  const [loc,setLoc]        =useState("");
  const [posting,setPosting]=useState(false);
  const [err,setErr]        =useState("");
  const { showToast }       = useStore();
  const fileRef             = useRef(null);
  const SAMPLES=["smp1","smp2","smp3","smp4","smp5","smp6","smp7","smp8","smp9"];
  const share=async()=>{
    if(posting||(!file&&!imgUrl))return setErr("Select an image first");
    setPosting(true);setErr("");
    try{const d={caption,location:loc};if(file)d.media=file;else d.image_url=imgUrl;await postsApi.create(d);showToast("Posted! 🎉","success");onClose();window.dispatchEvent(new CustomEvent("refresh-feed"));}
    catch(e){setErr(e.response?.data?.error||"Failed to post");}
    setPosting(false);
  };
  return (
    <div className="modal" style={{zIndex:800}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 12px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <button onClick={step==="edit"?()=>{setStep("pick");setPreview(null);}:onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text)",fontSize:15,fontFamily:"var(--font)",padding:4}}>{step==="edit"?"Back":"Cancel"}</button>
        <span style={{fontWeight:700,fontSize:17}}>New post</span>
        {step==="edit"?<button onClick={share} disabled={posting} style={{background:"none",border:"none",color:posting?"var(--text3)":"var(--accent)",fontWeight:700,fontSize:15,cursor:posting?"default":"pointer",fontFamily:"var(--font)"}}>{posting?"Sharing…":"Share"}</button>:<div style={{width:56}}/>}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {step==="pick"?(
          <div style={{padding:16}}>
            <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:16,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",color:"var(--text)",fontSize:15,cursor:"pointer",fontFamily:"var(--font)",marginBottom:20}}>📷 Upload from device</button>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setFile(f);setImgUrl("");setPreview(URL.createObjectURL(f));setStep("edit");}} style={{display:"none"}}/>
            <div style={{color:"var(--text2)",fontSize:13,marginBottom:10}}>Or choose a sample photo</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
              {SAMPLES.map(s=><div key={s} onClick={()=>{setImgUrl(`https://picsum.photos/seed/${s}/600/600`);setPreview(`https://picsum.photos/seed/${s}/600/600`);setStep("edit");}} style={{aspectRatio:"1",overflow:"hidden",cursor:"pointer",borderRadius:4}}><img src={`https://picsum.photos/seed/${s}/200/200`} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>)}
            </div>
          </div>
        ):(
          <div>
            {preview&&<img src={preview} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover"}}/>}
            <div style={{padding:14}}>
              <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Write a caption… #hashtags @mentions" rows={4} style={{width:"100%",background:"none",border:"none",color:"var(--text)",fontSize:15,outline:"none",resize:"none",fontFamily:"var(--font)",lineHeight:1.6}}/>
              <div className="divider" style={{margin:"10px 0"}}/>
              <input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="📍 Add location" style={{width:"100%",background:"none",border:"none",color:"var(--text)",fontSize:14,outline:"none",fontFamily:"var(--font)"}}/>
              {err&&<div style={{color:"var(--danger)",fontSize:13,marginTop:10}}>{err}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast() {
  const toasts = useStore(s=>s.toasts);
  return <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast${t.type&&t.type!=="info"?` ${t.type}`:""}`}>{t.message}</div>)}</div>;
}

// ── StoryBar ──────────────────────────────────────────────────────────────────
export function StoryBar({ groups }) {
  const [viewing,setViewing]=useState(null);
  const { user }            =useStore();
  if(!groups?.length) return null;
  return (
    <>
      <div style={{display:"flex",gap:12,padding:"12px 14px",overflowX:"auto",borderBottom:"1px solid var(--border)"}}>
        {groups.map(g=>{
          const isOwn=g.user_id===user?.id;
          return(
            <div key={g.user_id} onClick={()=>!isOwn&&g.stories?.length&&setViewing(g)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",minWidth:70,flexShrink:0}}>
              <div style={{width:66,height:66,borderRadius:"50%",padding:2,background:isOwn?"none":g.all_seen?"var(--border2)":"var(--gradient)",position:"relative"}}>
                <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"var(--bg)",padding:2}}>
                  <img src={g.avatar||`https://i.pravatar.cc/66?u=${g.user_id}`} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} onError={e=>{e.target.src=`https://i.pravatar.cc/66?u=${g.user_id}`;}}/>
                </div>
                {isOwn&&<div style={{position:"absolute",bottom:1,right:1,width:22,height:22,borderRadius:"50%",background:"var(--accent)",border:"2.5px solid var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700}}>+</div>}
              </div>
              <span style={{fontSize:11,color:isOwn?"var(--text)":g.all_seen?"var(--text3)":"var(--text)",maxWidth:66,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center"}}>{isOwn?"Your story":g.username}</span>
            </div>
          );
        })}
      </div>
      {viewing&&<StoryViewer group={viewing} onClose={()=>setViewing(null)}/>}
    </>
  );
}

function StoryViewer({ group, onClose }) {
  const [idx,setIdx]    =useState(0);
  const [prog,setProg]  =useState(0);
  const [reply,setReply]=useState("");
  const timer           =useRef(null);
  const story           =group.stories[idx];
  const DUR             =story?.duration||5000;
  useEffect(()=>{
    storiesApi.view(story.id).catch(()=>{});
    setProg(0);clearInterval(timer.current);
    const step=100/(DUR/80);
    timer.current=setInterval(()=>{setProg(p=>{if(p+step>=100){clearInterval(timer.current);if(idx<group.stories.length-1)setIdx(i=>i+1);else onClose();return 0;}return p+step;});},80);
    return()=>clearInterval(timer.current);
  },[idx]);
  return (
    <div className="story-viewer">
      <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",gap:3,padding:"10px 12px 0",zIndex:10}}>
        {group.stories.map((_,i)=><div key={i} style={{flex:1,height:2,background:"rgba(255,255,255,0.3)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:"#fff",borderRadius:2,width:i<idx?"100%":i===idx?`${prog}%`:"0%",transition:i===idx?"none":undefined}}/></div>)}
      </div>
      <div style={{position:"absolute",top:22,left:0,right:0,zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <img src={group.avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"1.5px solid rgba(255,255,255,0.7)"}}/>
          <span style={{color:"#fff",fontWeight:700,fontSize:14}}>{group.username}</span>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={24} color="#fff"/></button>
      </div>
      <img src={story.media_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} onError={e=>{e.target.src=`https://picsum.photos/seed/${story.id}/400/700`;}}/>
      {story.text&&<div style={{position:"absolute",bottom:100,left:0,right:0,textAlign:"center",padding:"10px 20px",color:"#fff",fontWeight:700,fontSize:18,textShadow:"0 2px 8px rgba(0,0,0,0.8)"}}>{story.text}</div>}
      <div style={{position:"absolute",inset:"70px 0 80px",display:"flex",zIndex:5}}>
        <div style={{flex:1}} onClick={()=>idx>0?setIdx(i=>i-1):onClose()}/>
        <div style={{flex:1}} onClick={()=>idx<group.stories.length-1?setIdx(i=>i+1):onClose()}/>
      </div>
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 12px 20px",display:"flex",alignItems:"center",gap:10,zIndex:10}}>
        <input value={reply} onChange={e=>setReply(e.target.value)} placeholder={`Reply to ${group.username}…`} style={{flex:1,background:"transparent",border:"1.5px solid rgba(255,255,255,0.45)",borderRadius:24,padding:"10px 16px",color:"#fff",fontSize:14,outline:"none",fontFamily:"var(--font)"}}/>
        {["❤️","🔥","😍","😂","👏"].map(e=><span key={e} onClick={()=>{storiesApi.react(story.id,e).catch(()=>{});setReply("");}} style={{fontSize:22,cursor:"pointer"}}>{e}</span>)}
      </div>
    </div>
  );
}

export default PostCard;
