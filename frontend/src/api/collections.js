// Append these to the existing api/index.js
// These are added at the bottom of the file

export const collectionsApi = {
  list:         ()              => api.get("/collections"),
  get:          (id)            => api.get(`/collections/${id}`),
  create:       (name, priv)    => api.post("/collections", { name, is_private: priv }),
  update:       (id, d)         => api.patch(`/collections/${id}`, d),
  delete:       (id)            => api.delete(`/collections/${id}`),
  addPost:      (id, postId)    => api.post(`/collections/${id}/add`, { post_id: postId }),
  removePost:   (id, postId)    => api.delete(`/collections/${id}/remove`, { data: { post_id: postId } }),
};

export const activityApi = {
  feed:         ()              => api.get("/activity"),
  suggested:    (limit=18)      => api.get(`/activity/suggested?limit=${limit}`),
};
