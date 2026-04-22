import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usersApi } from "../api/index.js";
import { PageHeader, Avatar, VerifiedBadge } from "../components/Shared.jsx";

function FollowBtn({ username, isFollowing: init }) {
  const [following, setFollowing] = useState(init);
  const toggle = async () => {
    setFollowing(f => !f);
    try { await usersApi.follow(username); } catch { setFollowing(f => !f); }
  };
  return (
    <button onClick={toggle} className={`btn-follow${following?" following":""}`} style={{ padding:"7px 16px", fontSize:13 }}>
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function FollowersScreen({ type }) {
  const { username } = useParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const fn = type === "followers" ? usersApi.followers : usersApi.following;
    fn(username).then(r => { setUsers(r.data.users||[]); setLoading(false); }).catch(() => setLoading(false));
  }, [username, type]);

  return (
    <div>
      <PageHeader title={type === "followers" ? "Followers" : "Following"} subtitle={`@${username}`} />
      {loading
        ? <div style={{ textAlign:"center", padding:40 }}><div className="spinner"/></div>
        : users.length === 0
          ? <div className="empty-state"><div className="icon">👤</div><div className="title">No {type} yet</div></div>
          : users.map(u => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px" }}>
                <Avatar src={u.avatar} userId={u.id} size={50} onClick={() => nav(`/${u.username}`)} />
                <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => nav(`/${u.username}`)}>
                  <div style={{ display:"flex", alignItems:"center", gap:4, fontWeight:700, fontSize:14 }}>
                    {u.username}{u.is_verified && <VerifiedBadge size={13}/>}
                  </div>
                  <div style={{ color:"var(--text2)", fontSize:13 }}>{u.name}</div>
                </div>
                {!u.is_me && <FollowBtn username={u.username} isFollowing={!!u.is_following} />}
              </div>
            ))
      }
    </div>
  );
}

export default FollowersScreen;
