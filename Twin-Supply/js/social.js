/* social.js
   - Guardar/Favoritos: localStorage("favorites") = [ids]
   - Likes: localStorage("likes") = { [id]: count }, y "liked" = [ids]
   - Comments por producto: localStorage("comments") = { [id]: [{name,text,ts}] }
*/

const FAV_KEY = "favorites";
const LIKES_KEY = "likes";
const LIKED_KEY = "likedProducts";
const COMMENTS_KEY = "comments";

function getFavs() {
  try {
    const x = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(x) ? x.map(Number) : [];
  } catch { return []; }
}
function setFavs(list) {
  const clean = Array.from(new Set((list || []).map(Number)));
  localStorage.setItem(FAV_KEY, JSON.stringify(clean));
  return clean;
}
function isFav(id) {
  return getFavs().includes(Number(id));
}
function toggleFav(id) {
  const pid = Number(id);
  let favs = getFavs();
  if (favs.includes(pid)) favs = favs.filter(x => x !== pid);
  else favs.push(pid);
  setFavs(favs);
  return favs.includes(pid);
}

function getLikesMap() {
  try {
    const x = JSON.parse(localStorage.getItem(LIKES_KEY) || "{}");
    return (x && typeof x === "object") ? x : {};
  } catch { return {}; }
}
function setLikesMap(map) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(map || {}));
}
function getLikedSet() {
  try {
    const x = JSON.parse(localStorage.getItem(LIKED_KEY) || "[]");
    const arr = Array.isArray(x) ? x.map(Number) : [];
    return new Set(arr);
  } catch { return new Set(); }
}
function setLikedSet(set) {
  localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(set)));
}
function getLikeCount(id) {
  const map = getLikesMap();
  return Number(map[String(Number(id))] || 0);
}
function hasLiked(id) {
  return getLikedSet().has(Number(id));
}
function toggleLike(id) {
  const pid = Number(id);
  const map = getLikesMap();
  const liked = getLikedSet();

  const key = String(pid);
  const current = Number(map[key] || 0);

  if (liked.has(pid)) {
    liked.delete(pid);
    map[key] = Math.max(0, current - 1);
    setLikesMap(map);
    setLikedSet(liked);
    return { liked:false, count: map[key] };
  } else {
    liked.add(pid);
    map[key] = current + 1;
    setLikesMap(map);
    setLikedSet(liked);
    return { liked:true, count: map[key] };
  }
}

function getCommentsAll() {
  try {
    const x = JSON.parse(localStorage.getItem(COMMENTS_KEY) || "{}");
    return (x && typeof x === "object") ? x : {};
  } catch { return {}; }
}
function getComments(productId) {
  const all = getCommentsAll();
  const list = all[String(Number(productId))];
  return Array.isArray(list) ? list : [];
}
function addComment(productId, name, text) {
  const pid = Number(productId);
  const all = getCommentsAll();
  const key = String(pid);
  const list = Array.isArray(all[key]) ? all[key] : [];
  list.unshift({
    name: String(name || "Anon").slice(0, 40),
    text: String(text || "").slice(0, 600),
    ts: Date.now()
  });
  all[key] = list;
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
  return list;
}

/* Export */
window.getFavs = getFavs;
window.toggleFav = toggleFav;
window.isFav = isFav;

window.getLikeCount = getLikeCount;
window.hasLiked = hasLiked;
window.toggleLike = toggleLike;

window.getComments = getComments;
window.addComment = addComment;
