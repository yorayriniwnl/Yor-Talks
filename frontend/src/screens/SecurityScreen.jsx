import { useState, useEffect } from "react";
import { Shield, Smartphone, Lock, Trash2, Download } from "lucide-react";
import { authApi } from "../api/index.js";
import { useStore } from "../store/index.js";
import { PageHeader, Switch } from "../components/Shared.jsx";

export function SecurityScreen() {
  const [sessions,  setSessions]  = useState([]);
  const [has2fa,    setHas2fa]    = useState(false);
  const [setup2fa,  setSetup2fa]  = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [totp,      setTotp]      = useState("");
  const [pwForm,    setPwForm]    = useState({ current:"", newPw:"", confirm:"" });
  const [pwErr,     setPwErr]     = useState("");
  const [pwOk,      setPwOk]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  const { user, showToast } = useStore();

  useEffect(() => {
    authApi.sessions().then(r => setSessions(r.data.sessions||[])).catch(()=>{});
    setHas2fa(!!user?.two_factor_enabled);
  }, []);

  const changePassword = async () => {
    setPwErr(""); setPwOk(false);
    if (!pwForm.current)               return setPwErr("Enter your current password");
    if (pwForm.newPw !== pwForm.confirm)return setPwErr("New passwords don't match");
    if (pwForm.newPw.length < 8)       return setPwErr("Min 8 characters");
    setSaving(true);
    try {
      await authApi.changePassword(pwForm.current, pwForm.newPw);
      setPwOk(true); setPwForm({ current:"", newPw:"", confirm:"" });
      showToast("Password updated!", "success");
    } catch (e) { setPwErr(e.response?.data?.error || "Update failed"); }
    setSaving(false);
  };

  const enable2fa = async () => {
    try {
      await authApi.enable2FA(totp);
      setHas2fa(true); setSetup2fa(null); setTotp("");
      showToast("2FA enabled! 🔐", "success");
    } catch (e) { showToast(e.response?.data?.error || "Invalid code", "error"); }
  };

  const disable2fa = async () => {
    try {
      await authApi.disable2FA(totp);
      setHas2fa(false); setDisabling(false); setTotp("");
      showToast("2FA disabled", "success");
    } catch (e) { showToast(e.response?.data?.error || "Invalid code", "error"); }
  };

  const exportData = async () => {
    try {
      const { data } = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type:"application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download:"yor-talks-data.json" });
      a.click(); URL.revokeObjectURL(a.href);
      showToast("Downloaded!", "success");
    } catch { showToast("Export failed", "error"); }
  };

  return (
    <div>
      <PageHeader title="Password & Security" />

      <div style={{ padding:"20px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <Lock size={20} color="var(--text2)" /><span style={{ fontWeight:700, fontSize:15 }}>Change Password</span>
        </div>
        {[{k:"current",ph:"Current password"},{k:"newPw",ph:"New password (min 8 chars)"},{k:"confirm",ph:"Confirm new password"}].map(f => (
          <input key={f.k} type="password" placeholder={f.ph} value={pwForm[f.k]}
            onChange={e => setPwForm(p => ({...p,[f.k]:e.target.value}))} className="input" style={{ marginBottom:10 }}
            onKeyDown={e => e.key==="Enter" && changePassword()} />
        ))}
        {pwErr && <div style={{ color:"var(--danger)", fontSize:13, marginBottom:10 }}>{pwErr}</div>}
        {pwOk  && <div style={{ color:"var(--success)", fontSize:13, marginBottom:10 }}>✓ Password updated!</div>}
        <button className="btn-primary" onClick={changePassword} disabled={saving}>{saving?"Updating…":"Update Password"}</button>
      </div>

      <div style={{ padding:"20px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: (setup2fa || disabling) ? 16 : 0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Smartphone size={20} color="var(--text2)" />
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Two-Factor Authentication</div>
              <div style={{ color:"var(--text2)", fontSize:13, marginTop:2 }}>{has2fa ? "✓ Enabled" : "Add extra account protection"}</div>
            </div>
          </div>
          <Switch value={has2fa} onChange={async v => {
            if (v) { try { const {data}=await authApi.setup2FA(); setSetup2fa(data); } catch(e){showToast(e.response?.data?.error||"Failed","error");} }
            else setDisabling(true);
          }} />
        </div>

        {setup2fa && !has2fa && (
          <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:16 }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Scan with your authenticator app:</div>
            <div style={{ background:"#fff", padding:16, borderRadius:8, marginBottom:14, display:"flex", justifyContent:"center" }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup2fa.uri)}`} alt="QR" style={{ width:200, height:200 }} />
            </div>
            <div style={{ color:"var(--text2)", fontSize:12, marginBottom:6 }}>Or enter secret manually:</div>
            <div style={{ fontFamily:"monospace", background:"var(--surface2)", padding:"8px 12px", borderRadius:6, fontSize:13, letterSpacing:2, marginBottom:14, wordBreak:"break-all" }}>{setup2fa.secret}</div>
            <input placeholder="Enter 6-digit code" value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g,""))} maxLength={6}
              className="input" style={{ textAlign:"center", letterSpacing:8, fontSize:22, marginBottom:12 }} onKeyDown={e => e.key==="Enter"&&enable2fa()} />
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn-primary" onClick={enable2fa} disabled={totp.length<6} style={{ flex:1 }}>Enable 2FA</button>
              <button className="btn-ghost" onClick={() => { setSetup2fa(null); setTotp(""); }} style={{ flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {disabling && (
          <div style={{ background:"rgba(255,48,64,0.06)", borderRadius:"var(--radius)", padding:16, border:"1px solid rgba(255,48,64,0.2)" }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12, color:"var(--danger)" }}>Enter code to disable 2FA:</div>
            <input placeholder="6-digit code" value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g,""))} maxLength={6}
              className="input" style={{ textAlign:"center", letterSpacing:8, fontSize:22, marginBottom:12 }} onKeyDown={e => e.key==="Enter"&&disable2fa()} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={disable2fa} disabled={totp.length<6} style={{ flex:1, background:"var(--danger)", color:"#fff", border:"none", borderRadius:"var(--radius-sm)", padding:13, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"var(--font)", opacity:totp.length<6?.5:1 }}>Disable 2FA</button>
              <button className="btn-ghost" onClick={() => { setDisabling(false); setTotp(""); }} style={{ flex:1 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:"16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Shield size={20} color="var(--text2)" /><span style={{ fontWeight:700, fontSize:15 }}>Active Sessions</span>
        </div>
        {sessions.length === 0
          ? <div style={{ color:"var(--text2)", fontSize:14 }}>No active sessions</div>
          : sessions.map(s => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{s.device||"Unknown device"}</div>
                  <div style={{ fontSize:12, color:"var(--text2)" }}>{s.ip||"Unknown IP"} · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <button onClick={() => authApi.deleteSession(s.id).then(()=>setSessions(ss=>ss.filter(x=>x.id!==s.id)))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--danger)", padding:6 }}><Trash2 size={16}/></button>
              </div>
            ))
        }
      </div>

      <div style={{ padding:16 }}>
        <button onClick={exportData} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", padding:13, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", color:"var(--text)", fontFamily:"var(--font)", fontSize:14 }}>
          <Download size={18} color="var(--text2)" /> Download my data (GDPR)
        </button>
      </div>
    </div>
  );
}

export default SecurityScreen;
