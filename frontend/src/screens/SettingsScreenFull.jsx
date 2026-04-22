import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, Bookmark, Archive, BarChart2, Flag, Shield, ChevronRight, Bell, Moon, Users, Heart, Activity, Grid, LogOut } from "lucide-react";
import { useStore } from "../store/index.js";
import { authApi } from "../api/index.js";
import { Switch } from "../components/Shared.jsx";
import { useState } from "react";

export function SettingsScreen() {
  const { user, logout, showToast, setUser } = useStore();
  const nav = useNavigate();
  const [isPrivate, setIsPrivate] = useState(!!user?.is_private);
  const [notifs,    setNotifs]    = useState(true);

  const togglePrivate = async () => {
    const next = !isPrivate;
    setIsPrivate(next);
    try {
      const { data } = await authApi.updateMe({ is_private: next });
      setUser(data.user);
      showToast(next ? "Account set to Private" : "Account set to Public", "success");
    } catch { setIsPrivate(!next); showToast("Failed", "error"); }
  };

  const handleLogout = async () => { await logout(); nav("/auth"); };

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:4 }}>
      {title && <div style={{ padding:"16px 16px 6px", fontSize:12, color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>{title}</div>}
      {children}
    </div>
  );

  const Row = ({ icon, label, sub, right, onClick, danger }) => (
    <button onClick={onClick} className="settings-row" style={{ color: danger ? "var(--danger)" : "var(--text)" }}>
      <span className="icon" style={{ color: danger ? "var(--danger)" : "var(--text2)" }}>{icon}</span>
      <div className="info">
        <div className="label" style={{ color: danger ? "var(--danger)" : "var(--text)" }}>{label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right ?? <ChevronRight size={16} color="var(--text3)" />}
    </button>
  );

  return (
    <div style={{ paddingBottom:40 }}>
      {/* Profile preview */}
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 16px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer" }} onClick={() => nav("/profile")}>
        <img src={user?.avatar || `https://i.pravatar.cc/52?u=${user?.id}`} alt="" style={{ width:52, height:52, borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.src=`https://i.pravatar.cc/52?u=${user?.id}`; }} />
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{user?.name}</div>
          <div style={{ color:"var(--text2)", fontSize:13 }}>@{user?.username}</div>
        </div>
        <ChevronRight size={17} color="var(--text3)" />
      </div>

      <Section title="Account">
        <Row icon={<User size={20}/>}  label="Edit Profile"         onClick={() => nav("/edit-profile")} />
        <Row icon={<Lock size={20}/>}  label="Password & Security"  onClick={() => nav("/settings/security")} />
        <Row icon={<Eye size={20}/>}   label="Account Privacy" sub={isPrivate ? "Private account" : "Public account"} right={<Switch value={isPrivate} onChange={togglePrivate} />} onClick={() => {}} />
      </Section>

      <Section title="Content & Activity">
        <Row icon={<Bookmark size={20}/>} label="Saved Posts"      onClick={() => nav("/saved")} />
        <Row icon={<Grid size={20}/>}      label="Collections"     onClick={() => nav("/collections")} />
        <Row icon={<Archive size={20}/>}  label="Archive"          onClick={() => nav("/archive")} />
        <Row icon={<Activity size={20}/>} label="Friend Activity"  onClick={() => nav("/activity")} />
        <Row icon={<BarChart2 size={20}/>} label="Analytics"       onClick={() => nav("/analytics")} />
      </Section>

      <Section title="Notifications">
        <Row icon={<Bell size={20}/>} label="Push Notifications" sub={notifs ? "Enabled" : "Disabled"} right={<Switch value={notifs} onChange={setNotifs} />} onClick={() => {}} />
      </Section>

      <Section title="Support">
        <Row icon={<Flag size={20}/>}   label="Report a Problem"  onClick={() => showToast("Thanks for the feedback! 🙏")} />
        <Row icon={<Shield size={20}/>} label="Privacy Policy"    onClick={() => window.open("https://yortalks.com/privacy","_blank")} />
        <Row icon={<Users size={20}/>}  label="Terms of Service"  onClick={() => window.open("https://yortalks.com/terms","_blank")} />
      </Section>

      {user?.is_admin && (
        <Section title="Admin">
          <Row icon={<Shield size={20}/>} label="Admin Panel" sub="Manage users & content" onClick={() => nav("/admin")} />
        </Section>
      )}

      <Section>
        <Row icon={<LogOut size={20}/>} label="Log Out" danger onClick={handleLogout} right={null} />
      </Section>

      <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text3)", fontSize:12 }}>
        Yor Talks v2.0 · © 2024
      </div>
    </div>
  );
}

export default SettingsScreen;
