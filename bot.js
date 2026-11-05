require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
const PORT = Number(process.env.PORT || 3000);
const DEV_MODE = process.env.DEV_MODE === "true";
if (!TOKEN) {
  console.error("BOT_TOKEN topilmadi. .env faylini yarating va token kiriting.");
  process.exit(1);
}
if (!APP_URL && !DEV_MODE) {
  console.warn("APP_URL belgilanmagan. Bot ishlaydi, lekin Mini App tugmasi uchun HTTPS URL kerak.");
}
const DATA_FILE = path.join(__dirname, "data.json");
function readDB() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { console.error("data.json o'qilmadi:", e.message); process.exit(1); }
}
let db = readDB();
function saveDB() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}
function ensureUser(tg) {
  const id = String(tg.id);
  if (!db.users[id]) {
    db.users[id] = { id, firstName: tg.first_name || "Player", lastName: tg.last_name || "",
      username: tg.username || "", photoUrl: "", phone: "", xp: 0, level: 1,
      gamesPlayed: 0, correctAnswers: 0, totalAnswers: 0, createdAt: new Date().toISOString() };
  } else {
    Object.assign(db.users[id], { firstName: tg.first_name || db.users[id].firstName,
      lastName: tg.last_name || db.users[id].lastName, username: tg.username || db.users[id].username });
  }
  saveDB();
  return db.users[id];
}
function rankOf(id) {
  const sorted = Object.values(db.users).sort((a,b) => b.xp-a.xp || a.createdAt.localeCompare(b.createdAt));
  return Math.max(1, sorted.findIndex(u => u.id === String(id)) + 1);
}
function topUsers(limit=10) {
  return Object.values(db.users).sort((a,b)=>b.xp-a.xp).slice(0,limit);
}
function esc(s="") { return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

function verifyInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const entries = [...params.entries()].sort(([a],[b])=>a.localeCompare(b));
  const dataCheckString = entries.map(([k,v])=>`${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex"), b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now()/1000 - authDate > 86400) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}
const app = express();
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req,res)=>res.json({ok:true,service:"Quizly"}));
app.use("/api", (req,res,next)=>{
  const initData = req.get("x-telegram-init-data") || "";
  let tgUser = verifyInitData(initData);
  if (!tgUser && DEV_MODE) tgUser = {id:999000001,first_name:"Demo",username:"demo_user"};
  if (!tgUser) return res.status(401).json({error:"Telegram sessiyasi tasdiqlanmadi. Mini App'ni Telegram ichidan oching."});
  req.user = ensureUser(tgUser);
  next();
});
app.get("/api/me",(req,res)=>res.json({user:req.user,rank:rankOf(req.user.id),totalUsers:Object.keys(db.users).length}));
app.get("/api/leaderboard",(req,res)=>{
  const users=topUsers(100).map((u,i)=>({rank:i+1,id:u.id,name:[u.firstName,u.lastName].filter(Boolean).join(" "),username:u.username,xp:u.xp,level:u.level}));
  res.json({users,myRank:rankOf(req.user.id)});
});
app.get("/api/questions",(req,res)=>{
  const questions=db.questions.map(q=>({id:q.id,category:q.category,question:q.question,options:q.options}));
  res.json({questions});
});
app.post("/api/answer",(req,res)=>{
  const {answers}=req.body || {};
  if (!Array.isArray(answers) || !answers.length || answers.length>30) return res.status(400).json({error:"Javoblar noto'g'ri."});
  let correct=0;
  for (const a of answers) {
    const q=db.questions.find(x=>x.id===Number(a.questionId));
    if (!q) continue;
    if (Number(a.optionIndex)===q.answer) correct++;
  }
  const xp=correct*10;
  req.user.xp+=xp; req.user.level=Math.floor(req.user.xp/200)+1;
  req.user.gamesPlayed++; req.user.correctAnswers+=correct; req.user.totalAnswers+=answers.length;
  db.matches.unshift({id:crypto.randomUUID(),userId:req.user.id,correct,total:answers.length,xp,createdAt:new Date().toISOString()});
  db.matches=db.matches.slice(0,5000); saveDB();
  res.json({correct,total:answers.length,xp,user:req.user,rank:rankOf(req.user.id)});
});
app.post("/api/phone",(req,res)=>{
  const phone=String(req.body.phone||"").trim();
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return res.status(400).json({error:"Telefon raqami formati noto'g'ri."});
  req.user.phone=phone; saveDB(); res.json({ok:true});
});
app.post("/api/rooms",(req,res)=>{
  const code=String(Math.floor(100000+Math.random()*900000));
  db.rooms[code]={code,hostId:req.user.id,players:[req.user.id],status:"waiting",createdAt:Date.now(),questionIds:db.questions.slice(0,5).map(q=>q.id),answers:{}};
  saveDB(); res.json({room:db.rooms[code]});
});
app.post("/api/rooms/join",(req,res)=>{
  const code=String(req.body.code||"").trim(), room=db.rooms[code];
  if(!room) return res.status(404).json({error:"Xona topilmadi."});
  if(room.status!=="waiting") return res.status(400).json({error:"Bu xona allaqachon boshlangan."});
  if(!room.players.includes(req.user.id)) room.players.push(req.user.id);
  saveDB(); res.json({room:{code:room.code,players:room.players.length,status:room.status}});
});
app.get("/api/rooms/:code",(req,res)=>{
  const room=db.rooms[String(req.params.code)];
  if(!room || !room.players.includes(req.user.id)) return res.status(404).json({error:"Xona topilmadi."});
  res.json({room:{code:room.code,players:room.players.length,status:room.status,hostId:room.hostId}});
});
app.post("/api/rooms/:code/start",(req,res)=>{
  const room=db.rooms[String(req.params.code)];
  if(!room || room.hostId!==req.user.id) return res.status(403).json({error:"Faqat xona egasi boshlashi mumkin."});
  room.status="started"; room.startedAt=Date.now(); saveDB(); res.json({ok:true});
});

const bot = new Telegraf(TOKEN);
function mainKeyboard() {
  const rows=[];
  if (APP_URL) rows.push([Markup.button.webApp("🚀 Quizly'ni ochish", APP_URL)]);
  rows.push([Markup.button.callback("🏆 Reyting", "rank"),Markup.button.callback("👤 Profil", "profile")]);
  return Markup.inlineKeyboard(rows);
}
bot.start(ctx=>{
  const u=ensureUser(ctx.from);
  ctx.reply(`Salom, ${esc(u.firstName)}! 👋\n\nQuizly'ga xush kelibsiz.\nBu yerda quiz ishlang, XP to'plang va reytingda yuqorilang.`,mainKeyboard());
});
bot.command("rank",ctx=>{
  const rows=topUsers(10);
  const lines=rows.length?rows.map((u,i)=>`${["🥇","🥈","🥉"][i]||`${i+1}.`} ${esc(u.firstName)}${u.username?` (@${esc(u.username)})`:""} — ${u.xp} XP`):["Hozircha reyting bo'sh."];
  const me=ensureUser(ctx.from);
  ctx.reply(`🏆 QUIZLY GLOBAL RANK\n\n${lines.join("\n")}\n\nSizning o'rningiz: #${rankOf(me.id)}\nXP: ${me.xp}`,mainKeyboard());
});
bot.command("profile",ctx=>{
  const u=ensureUser(ctx.from);
  ctx.reply(`👤 QUIZLY PROFILE\n\nIsm: ${esc(u.firstName)} ${esc(u.lastName)}\nUsername: ${u.username?`@${esc(u.username)}`:"yo'q"}\nXP: ${u.xp}\nLevel: ${u.level}\nO'rin: #${rankOf(u.id)}\nO'yinlar: ${u.gamesPlayed}\nTo'g'ri javoblar: ${u.correctAnswers}/${u.totalAnswers}`,mainKeyboard());
});
bot.action("rank",async ctx=>{await ctx.answerCbQuery();const rows=topUsers(10);const me=ensureUser(ctx.from);const lines=rows.map((u,i)=>`${i+1}. ${u.firstName} — ${u.xp} XP`);await ctx.reply(`🏆 TOP 10\n\n${lines.join("\n")||"Hozircha reyting bo'sh."}\n\nSiz: #${rankOf(me.id)}`,mainKeyboard());});
bot.action("profile",async ctx=>{await ctx.answerCbQuery();const u=ensureUser(ctx.from);await ctx.reply(`👤 ${u.firstName}\nXP: ${u.xp}\nLevel: ${u.level}\nReyting: #${rankOf(u.id)}\nO'yinlar: ${u.gamesPlayed}`,mainKeyboard());});
bot.catch(err=>console.error("Bot xatosi:",err));
app.listen(PORT,()=>console.log(`Quizly server http://localhost:${PORT}`));
bot.launch().then(()=>console.log("Quizly Telegram bot ishga tushdi.")).catch(e=>console.error("Bot ishga tushmadi:",e.message));
process.once("SIGINT",()=>bot.stop("SIGINT"));
process.once("SIGTERM",()=>bot.stop("SIGTERM"));
