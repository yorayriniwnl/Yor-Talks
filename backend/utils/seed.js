require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const db = require("../db");

console.log("🌱  Seeding Yor Talks v2 database...");

const hash = (p) => bcrypt.hashSync(p, 10);

const USERS = [
  { id: uuidv4(), username:"yor_user",       email:"yor@yortalks.com",     name:"Yor User",      bio:"Living life one frame at a time 📸✨", avatar:"https://i.pravatar.cc/150?img=11", is_verified:1, is_admin:1, email_verified:1 },
  { id: uuidv4(), username:"kai.visuals",    email:"kai@yortalks.com",     name:"Kai Visuals",   bio:"Photographer & dreamer 🌙", avatar:"https://i.pravatar.cc/150?img=2",  is_verified:1, email_verified:1 },
  { id: uuidv4(), username:"luna_creates",   email:"luna@yortalks.com",    name:"Luna Creates",  bio:"Art is my language 🎨", avatar:"https://i.pravatar.cc/150?img=5" },
  { id: uuidv4(), username:"zephyr.jpg",     email:"zephyr@yortalks.com",  name:"Zephyr Cole",   bio:"Adventure awaits 🏔️", avatar:"https://i.pravatar.cc/150?img=3",  is_verified:1, email_verified:1 },
  { id: uuidv4(), username:"theo_aesthetic", email:"theo@yortalks.com",    name:"Theo A.",       bio:"Minimalist. Traveler ☕", avatar:"https://i.pravatar.cc/150?img=7" },
  { id: uuidv4(), username:"mila.snaps",     email:"mila@yortalks.com",    name:"Mila Snaps",    bio:"Golden hour forever 🌅", avatar:"https://i.pravatar.cc/150?img=10", is_verified:1, email_verified:1 },
  { id: uuidv4(), username:"felix_world",    email:"felix@yortalks.com",   name:"Felix World",   bio:"Streets & souls 🏙️", avatar:"https://i.pravatar.cc/150?img=4" },
  { id: uuidv4(), username:"nora.frames",    email:"nora@yortalks.com",    name:"Nora Frames",   bio:"Capturing moments 💫", avatar:"https://i.pravatar.cc/150?img=9" },
  { id: uuidv4(), username:"riku_shoots",    email:"riku@yortalks.com",    name:"Riku Shoots",   bio:"Chasing light 🌤", avatar:"https://i.pravatar.cc/150?img=6" },
  { id: uuidv4(), username:"sol.frames",     email:"sol@yortalks.com",     name:"Sol Frames",    bio:"Sunsets are my religion 🌇", avatar:"https://i.pravatar.cc/150?img=8", is_verified:1, email_verified:1 },
];

const CAPTIONS = [
  "Golden hour never disappoints 🌅 #photography #goldenhour #vibes",
  "New painting in progress 🎨 Something big coming soon #art #painting",
  "Mountains calling and I must go 🏔️ #adventure #hiking #nature",
  "Minimalism is the ultimate sophistication ✨ #minimal #aesthetic",
  "Chasing the light wherever it goes 🌤️ #lifestyle #travel #photography",
  "The city never sleeps 🌃 #urban #street #nightphotography",
  "Some days are made for this kind of quiet 🍃 #calm #peace #nature",
  "Found paradise 🌊 #beach #summer #ocean #travel",
  "Architecture is frozen music 🏛️ #architecture #design #geometry",
  "Coffee first, everything else second ☕ #morning #coffeelover",
  "Lost in the desert 🏜️ Beautiful silence out here #desert #travel",
  "Autumn in the city 🍂 #fall #colors #streetphotography",
  "Sunrise yoga session 🧘 Best way to start the day #wellness #yoga",
  "Vintage finds 🎞️ #film #analog #vintage #aesthetic",
  "Forest therapy 🌲 Highly recommend #forest #nature #mindfulness",
];

db.exec("DELETE FROM user_analytics_daily; DELETE FROM post_analytics; DELETE FROM audit_log; DELETE FROM reports; DELETE FROM search_history; DELETE FROM highlight_stories; DELETE FROM highlights; DELETE FROM story_reactions; DELETE FROM story_views; DELETE FROM stories; DELETE FROM comment_likes; DELETE FROM comments; DELETE FROM saves; DELETE FROM likes; DELETE FROM post_tags; DELETE FROM post_media; DELETE FROM posts; DELETE FROM notifications; DELETE FROM messages; DELETE FROM conversation_members; DELETE FROM conversations; DELETE FROM close_friends; DELETE FROM follow_requests; DELETE FROM blocks; DELETE FROM follows; DELETE FROM password_resets; DELETE FROM refresh_tokens; DELETE FROM users;");

const pw = hash("password123");

db.transaction(() => {
  USERS.forEach(u => {
    db.prepare(`INSERT INTO users (id,username,email,password,name,bio,avatar,is_verified,is_admin,email_verified,followers_count,following_count,posts_count) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0)`)
      .run(u.id, u.username, u.email, pw, u.name, u.bio||"", u.avatar||`https://i.pravatar.cc/150?u=${u.id}`, u.is_verified||0, u.is_admin||0, u.email_verified||0);
  });

  const fc={}, fing={}, pc={};
  USERS.forEach(u => { fc[u.id]=0; fing[u.id]=0; pc[u.id]=0; });

  // Follows
  USERS.forEach(u => USERS.forEach(v => {
    if (u.id!==v.id && Math.random()>0.25) {
      db.prepare("INSERT OR IGNORE INTO follows (follower_id,following_id) VALUES (?,?)").run(u.id, v.id);
      fc[v.id]++; fing[u.id]++;
    }
  }));

  // Posts
  const postIds = [];
  USERS.forEach((u, ui) => {
    const n = 5 + Math.floor(Math.random() * 8);
    for (let i=0; i<n; i++) {
      const pid = uuidv4();
      const capIdx = (ui*3+i) % CAPTIONS.length;
      const hoursAgo = i * 4 + Math.floor(Math.random()*12);
      const lks = Math.floor(Math.random()*20000)+50;
      const cms = Math.floor(Math.random()*300)+2;
      const svs = Math.floor(Math.random()*3000)+10;
      const eng = (lks + cms*2 + svs*3) / Math.max(1, fc[u.id]);
      db.prepare(`INSERT INTO posts (id,user_id,caption,location,likes_count,comments_count,saves_count,engagement_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,datetime('now','-${hoursAgo} hours'),datetime('now','-${hoursAgo} hours'))`)
        .run(pid, u.id, CAPTIONS[capIdx], ["New York","Tokyo","Paris","London","Sydney","","",""][Math.floor(Math.random()*8)], lks, cms, svs, eng);

      // Multi-image media (1-3 images per post)
      const mediaCount = Math.random() > 0.7 ? Math.floor(Math.random()*2)+2 : 1;
      for (let m=0; m<mediaCount; m++) {
        db.prepare("INSERT INTO post_media (id,post_id,url,type,position) VALUES (?,?,?,?,?)").run(uuidv4(), pid, `https://picsum.photos/seed/${u.username}_${i}_${m}/600/600`, "image", m);
      }

      // Tags
      const cap = CAPTIONS[capIdx];
      const tags = (cap.match(/#[\w]+/g)||[]).map(t=>t.slice(1).toLowerCase());
      tags.forEach(t => {
        db.prepare("INSERT OR IGNORE INTO post_tags (post_id,tag) VALUES (?,?)").run(pid, t);
        db.prepare("INSERT INTO hashtags (id,name,posts_count) VALUES (?,?,1) ON CONFLICT(name) DO UPDATE SET posts_count=posts_count+1").run(uuidv4(), t);
      });

      // Analytics row
      db.prepare("INSERT INTO post_analytics (id,post_id,impressions,reach) VALUES (?,?,?,?)").run(uuidv4(), pid, lks*2, lks);

      postIds.push({ pid, uid: u.id });
      pc[u.id]++;
    }
  });

  // Likes & saves
  postIds.forEach(({ pid, uid }) => {
    USERS.filter(u=>u.id!==uid).forEach(u => {
      if (Math.random()>0.4) db.prepare("INSERT OR IGNORE INTO likes (user_id,post_id,created_at) VALUES (?,?,datetime('now',?))").run(u.id, pid, `-${Math.floor(Math.random()*100)} hours`);
      if (Math.random()>0.75) db.prepare("INSERT OR IGNORE INTO saves (user_id,post_id) VALUES (?,?)").run(u.id, pid);
    });
  });

  // Comments
  const commentTexts = ["Absolutely stunning! 😍","This is so beautiful 🙌","Goals!! 🌍","Love the composition 📸","Can't stop looking 💫","Fire 🔥🔥🔥","This made my day ✨","Incredible shot!","You're so talented 🎨","Where was this taken?","Obsessed with your feed 💙","The colours!!!! 😭","This belongs in a gallery","So inspiring 🌟","Perfect mood ✨"];
  postIds.forEach(({ pid, uid }) => {
    USERS.filter(u=>u.id!==uid).slice(0, 3+Math.floor(Math.random()*4)).forEach(u => {
      const cid=uuidv4();
      db.prepare("INSERT INTO comments (id,post_id,user_id,text,created_at) VALUES (?,?,?,?,datetime('now',?))").run(cid, pid, u.id, commentTexts[Math.floor(Math.random()*commentTexts.length)], `-${Math.floor(Math.random()*80)} hours`);
    });
  });

  // Stories
  USERS.forEach(u => {
    const n = Math.floor(Math.random()*3)+1;
    for (let j=0;j<n;j++) db.prepare(`INSERT INTO stories (id,user_id,media_url,media_type,expires_at,views_count,created_at) VALUES (?,?,?,?,datetime('now','+24 hours'),?,datetime('now','-${j*2} hours'))`)
      .run(uuidv4(), u.id, `https://picsum.photos/seed/story_${u.username}_${j}/400/700`, "image", Math.floor(Math.random()*500));
  });

  // Conversations + messages
  const me = USERS[0];
  [USERS[1], USERS[2], USERS[3]].forEach(other => {
    const cid=uuidv4();
    db.prepare("INSERT INTO conversations (id,type) VALUES (?,?)").run(cid, "dm");
    db.prepare("INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)").run(cid, me.id);
    db.prepare("INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)").run(cid, other.id);
    const msgs=[
      [me.id,    `Hey ${other.name.split(" ")[0]}! Love your content 🔥`, "-3 hours"],
      [other.id, "Thanks! Yours too, really inspiring!", "-2 hours 50 minutes"],
      [me.id,    "We should collaborate sometime!", "-2 hours 45 minutes"],
      [other.id, "Absolutely! DM me the details 📷", "-2 hours 40 minutes"],
    ];
    msgs.forEach(([sid, txt, delta]) => {
      const mid=uuidv4();
      db.prepare("INSERT INTO messages (id,conversation_id,sender_id,text,created_at) VALUES (?,?,?,?,datetime('now',?))").run(mid, cid, sid, txt, delta);
      db.prepare("UPDATE conversations SET updated_at=datetime('now',?), last_message_id=? WHERE id=?").run(delta, mid, cid);
    });
  });

  // Notifications
  const notifTypes = ["like","follow","comment","save"];
  USERS.slice(1,6).forEach((u,i) => {
    const pid = postIds.find(p=>p.uid===me.id)?.pid;
    db.prepare("INSERT INTO notifications (id,user_id,actor_id,type,entity_id,entity_type) VALUES (?,?,?,?,?,?)").run(uuidv4(), me.id, u.id, notifTypes[i%4], notifTypes[i%4]!=="follow"?pid:null, notifTypes[i%4]!=="follow"?"post":null);
  });

  // Update counts
  Object.entries(fc).forEach(([id,c]) => db.prepare("UPDATE users SET followers_count=? WHERE id=?").run(c,id));
  Object.entries(fing).forEach(([id,c]) => db.prepare("UPDATE users SET following_count=? WHERE id=?").run(c,id));
  Object.entries(pc).forEach(([id,c]) => db.prepare("UPDATE users SET posts_count=? WHERE id=?").run(c,id));

})();

console.log(`✅ Seeded ${USERS.length} users with posts, stories, DMs, follows & notifications`);
console.log("📧  Demo login: yor@yortalks.com / password123  (admin)");
