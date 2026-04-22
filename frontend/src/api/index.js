import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

let _access = localStorage.getItem("yt_access") || null;

export const setTokens = (a, r) => {
  _access = a;
  if (a) localStorage.setItem("yt_access", a); else localStorage.removeItem("yt_access");
  if (r) localStorage.setItem("yt_refresh", r); else localStorage.removeItem("yt_refresh");
};
export const getAccess = () => _access;

api.interceptors.request.use(cfg => {
  if (_access) cfg.headers.Authorization = `Bearer ${_access}`;
  return cfg;
});

api.interceptors.response.use(r => r, async err => {
  const orig = err.config;
  if (err.response?.status === 401 && !orig._retry) {
    orig._retry = true;
    const rf = localStorage.getItem("yt_refresh");
    if (!rf) { setTokens(null, null); window.location.href = "/auth"; return Promise.reject(err); }
    try {
      const { data } = await axios.post("/api/auth/refresh", { refresh: rf });
      setTokens(data.access, data.refresh);
      orig.headers.Authorization = `Bearer ${data.access}`;
      return api(orig);
    } catch {
      setTokens(null, null);
      window.location.href = "/auth";
      return Promise.reject(err);
    }
  }
  return Promise.reject(err);
});

export const authApi = {
  login:           (email, pw, totp)   => api.post("/auth/login",           { email, password: pw, totp_code: totp }),
  register:        (d)                  => api.post("/auth/register",         d),
  refresh:         ()                   => api.post("/auth/refresh",          { refresh: localStorage.getItem("yt_refresh") }),
  logout:          ()                   => api.post("/auth/logout",           { refresh: localStorage.getItem("yt_refresh") }),
  me:              ()                   => api.get("/auth/me"),
  updateMe:        (d)                  => api.patch("/auth/me",              d),
  uploadAvatar:    (f)                  => { const fd=new FormData(); fd.append("avatar",f); return api.post("/auth/avatar", fd); },
  changePassword:  (c,n)               => api.post("/auth/change-password",  { current:c, newPassword:n }),
  forgotPassword:  (email)             => api.post("/auth/forgot-password",  { email }),
  resetPassword:   (token, pw)         => api.post("/auth/reset-password",   { token, password:pw }),
  verifyEmail:     (token)             => api.get(`/auth/verify-email?token=${token}`),
  setup2FA:        ()                   => api.post("/auth/2fa/setup"),
  enable2FA:       (code)              => api.post("/auth/2fa/enable",       { code }),
  disable2FA:      (code)              => api.post("/auth/2fa/disable",      { code }),
  sessions:        ()                   => api.get("/auth/sessions"),
  deleteSession:   (id)                => api.delete(`/auth/sessions/${id}`),
  exportData:      ()                   => api.post("/auth/gdpr/export"),
  deleteAccount:   (pw)                => api.delete("/auth/account",        { data:{ password:pw } }),
};

export const postsApi = {
  feed:            (p=1)               => api.get(`/posts/feed?page=${p}`),
  explore:         (p=1)               => api.get(`/posts/explore?page=${p}`),
  saved:           (p=1)               => api.get(`/posts/saved?page=${p}`),
  archived:        ()                  => api.get("/posts/archived"),
  get:             (id)                => api.get(`/posts/${id}`),
  create:          (d)                 => { const fd=new FormData(); Object.entries(d).forEach(([k,v])=>{ if(Array.isArray(v)) v.forEach(i=>fd.append(k,i)); else fd.append(k,v); }); return api.post("/posts",fd); },
  update:          (id,d)              => api.patch(`/posts/${id}`,d),
  delete:          (id)                => api.delete(`/posts/${id}`),
  archive:         (id)                => api.post(`/posts/${id}/archive`),
  like:            (id)                => api.post(`/posts/${id}/like`),
  save:            (id, cid)           => api.post(`/posts/${id}/save`, { collection_id: cid }),
  comments:        (id, p=1)           => api.get(`/posts/${id}/comments?page=${p}`),
  addComment:      (id, text, pid)     => api.post(`/posts/${id}/comments`, { text, parent_id: pid }),
  deleteComment:   (pid, cid)          => api.delete(`/posts/${pid}/comments/${cid}`),
  likeComment:     (pid, cid)          => api.post(`/posts/${pid}/comments/${cid}/like`),
  pinComment:      (pid, cid)          => api.post(`/posts/${pid}/pin-comment`, { comment_id: cid }),
  report:          (id, reason, det)   => api.post(`/posts/${id}/report`, { reason, details: det }),
  analytics:       (id)                => api.get(`/posts/${id}/analytics`),
  likesList:       (id)                => api.get(`/posts/${id}/likes-list`),
};

export const usersApi = {
  get:             (u)                 => api.get(`/users/${u}`),
  posts:           (u, p=1)            => api.get(`/users/${u}/posts?page=${p}`),
  tagged:          (u)                 => api.get(`/users/tagged/${u}`),
  followers:       (u)                 => api.get(`/users/${u}/followers`),
  following:       (u)                 => api.get(`/users/${u}/following`),
  follow:          (u)                 => api.post(`/users/${u}/follow`),
  block:           (u)                 => api.post(`/users/${u}/block`),
  closeFriend:     (u)                 => api.post(`/users/${u}/close-friends`),
  search:          (q)                 => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  suggestions:     ()                  => api.get("/users/suggestions"),
  followRequests:  ()                  => api.get("/users/follow-requests/list"),
  handleRequest:   (id, action)        => api.post(`/users/${id}/follow-requests/${action}`),
};

export const storiesApi = {
  feed:            ()                  => api.get("/stories/feed"),
  create:          (d)                 => { const fd=new FormData(); Object.entries(d).forEach(([k,v])=>fd.append(k,v)); return api.post("/stories",fd); },
  view:            (id)                => api.post(`/stories/${id}/view`),
  react:           (id, emoji)         => api.post(`/stories/${id}/react`, { emoji }),
  viewers:         (id)                => api.get(`/stories/${id}/viewers`),
  delete:          (id)                => api.delete(`/stories/${id}`),
  highlights:      (uid)               => api.get(`/stories/highlights/${uid}`),
  createHighlight: (d)                 => api.post("/stories/highlights", d),
  deleteHighlight: (id)                => api.delete(`/stories/highlights/${id}`),
};

export const messagesApi = {
  conversations:   ()                  => api.get("/messages/conversations"),
  startDM:         (uid)               => api.post("/messages/conversations", { user_id: uid }),
  createGroup:     (ids, name)         => api.post("/messages/conversations", { user_ids: ids, type: "group", name }),
  messages:        (cid, p=1)          => api.get(`/messages/conversations/${cid}/messages?page=${p}`),
  deleteMsg:       (mid)               => api.delete(`/messages/messages/${mid}`),
  reactMsg:        (mid, emoji)        => api.post(`/messages/messages/${mid}/react`, { emoji }),
};

export const notifsApi = {
  list:            (p=1)               => api.get(`/notifs?page=${p}`),
  readAll:         ()                  => api.post("/notifs/read-all"),
  read:            (id)                => api.post(`/notifs/${id}/read`),
};

export const searchApi = {
  search:          (q)                 => api.get(`/search?q=${encodeURIComponent(q)}`),
  history:         ()                  => api.get("/search/history"),
  clearHistory:    ()                  => api.delete("/search/history"),
  trending:        ()                  => api.get("/search/trending"),
};

export const exploreApi = {
  trending:        ()                  => api.get("/explore/trending"),
  hashtag:         (tag, p=1)          => api.get(`/explore/hashtag/${tag}?page=${p}`),
  reels:           (p=1)               => api.get(`/explore/reels?page=${p}`),
};

export const analyticsApi = {
  overview:        ()                  => api.get("/analytics/overview"),
  posts:           (p=1)               => api.get(`/analytics/posts?page=${p}`),
  postDetail:      (id)                => api.get(`/posts/${id}/analytics`),
};

export const adminApi = {
  stats:           ()                  => api.get("/admin/stats"),
  users:           (p=1, q="")         => api.get(`/admin/users?page=${p}&q=${q}`),
  banUser:         (id, reason)        => api.post(`/admin/users/${id}/ban`, { reason }),
  unbanUser:       (id)                => api.post(`/admin/users/${id}/unban`),
  verifyUser:      (id)                => api.post(`/admin/users/${id}/verify`),
  reports:         (status="pending", p=1) => api.get(`/admin/reports?status=${status}&page=${p}`),
  resolveReport:   (id, action, type)  => api.post(`/admin/reports/${id}/resolve`, { action, entity_type: type }),
  posts:           (p=1)               => api.get(`/admin/posts?page=${p}`),
  deletePost:      (id)                => api.delete(`/admin/posts/${id}`),
  auditLog:        ()                  => api.get("/admin/audit-log"),
};

export default api;

export const collectionsApi = {
  list:       ()           => api.get("/collections"),
  get:        (id)         => api.get(`/collections/${id}`),
  create:     (name,priv)  => api.post("/collections", { name, is_private: priv }),
  update:     (id,d)       => api.patch(`/collections/${id}`, d),
  delete:     (id)         => api.delete(`/collections/${id}`),
  addPost:    (id,pid)     => api.post(`/collections/${id}/add`, { post_id: pid }),
  removePost: (id,pid)     => api.delete(`/collections/${id}/remove`, { data:{ post_id:pid } }),
};

export const activityApi = {
  feed:       ()           => api.get("/activity"),
  suggested:  (limit=18)   => api.get(`/activity/suggested?limit=${limit}`),
};
