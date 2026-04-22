// OnboardingScreen - shown after first register
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/index.js";
import { usersApi } from "../api/index.js";
import { UserRow } from "../components/Shared.jsx";

export function OnboardingScreen() {
  const [step,        setStep]        = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [followed,    setFollowed]    = useState(new Set());
  const [loading,     setLoading]     = useState(false);
  const { user } = useStore();
  const nav = useNavigate();

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.suggestions();
      setSuggestions(data.users || []);
    } catch {}
    setLoading(false);
  };

  const handleFollow = async (u) => {
    try {
      await usersApi.follow(u.username);
      setFollowed(f => { const n = new Set(f); n.add(u.id); return n; });
    } catch {}
  };

  const steps = [
    {
      title: "Welcome to Yor Talks! 🎉",
      subtitle: `Hey ${user?.name?.split(" ")[0] || "there"}, let's set you up.`,
      content: (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:72, marginBottom:20 }}>📸</div>
          <div style={{ color:"var(--text2)", fontSize:15, lineHeight:1.7 }}>
            Share moments, discover creators, and connect with people who inspire you.
          </div>
        </div>
      ),
      btnLabel: "Get Started",
      onNext: () => { loadSuggestions(); setStep(1); },
    },
    {
      title: "Follow some people",
      subtitle: "Your feed will come alive when you follow creators.",
      content: (
        <div>
          {loading
            ? <div style={{ textAlign:"center", padding:30 }}><div className="spinner" /></div>
            : suggestions.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  subtitle={`${(u.followers_count||0).toLocaleString()} followers`}
                  right={
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFollow(u); }}
                      className={`btn-follow${followed.has(u.id) ? " following" : ""}`}
                      style={{ padding:"7px 16px" }}
                    >
                      {followed.has(u.id) ? "Following" : "Follow"}
                    </button>
                  }
                />
              ))
          }
        </div>
      ),
      btnLabel: followed.size > 0 ? `Following ${followed.size} — Continue` : "Skip for now",
      onNext: () => setStep(2),
    },
    {
      title: "You're all set! 🚀",
      subtitle: "Start sharing your world.",
      content: (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:72, marginBottom:20 }}>✨</div>
          <div style={{ color:"var(--text2)", fontSize:15, lineHeight:1.7 }}>
            Create your first post, explore the feed, or slide into someone's DMs.
          </div>
        </div>
      ),
      btnLabel: "Go to my feed →",
      onNext: () => nav("/"),
    },
  ];

  const current = steps[step];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>
      {/* Progress bar */}
      <div style={{ display:"flex", gap:4, padding:"20px 20px 0" }}>
        {steps.map((_, i) => (
          <div key={i} className="progress-bar" style={{ flex:1 }}>
            <div className="progress-fill" style={{ width: i <= step ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      <div style={{ flex:1, padding:"32px 20px 24px", display:"flex", flexDirection:"column" }}>
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:26, fontWeight:800, marginBottom:8 }}>{current.title}</h1>
          <p style={{ color:"var(--text2)", fontSize:15 }}>{current.subtitle}</p>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>{current.content}</div>
      </div>

      <div style={{ padding:"16px 20px 32px" }}>
        <button className="btn-primary" onClick={current.onNext}>
          {current.btnLabel}
        </button>
        {step > 0 && step < steps.length - 1 && (
          <button onClick={() => setStep(s => s + 1)} style={{ display:"block", width:"100%", textAlign:"center", marginTop:12, background:"none", border:"none", color:"var(--text2)", fontSize:14, cursor:"pointer", fontFamily:"var(--font)" }}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardingScreen;
