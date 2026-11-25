const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.static('public'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_CHAT_ID;
const UPI = process.env.UPI_ID || process.env.UPI || '';

let downloadCount = 0;
let downloadToday = 0;
let lastStatDate = '';

// --- TELEGRAM SEND ---
async function sendTelegram(chatId, text, replyMarkup){
  try{
    let body = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if(replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  }catch(e){ console.log('tg err', e.message); }
}

// --- TABLES ---
async function initDb(){
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, title TEXT, price NUMERIC, type TEXT, rent_type TEXT, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, photo TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS workers(id SERIAL PRIMARY KEY, name TEXT, skill TEXT, charge NUMERIC, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS mazdoori(id SERIAL PRIMARY KEY, kya_karwana TEXT, kab TEXT, paisa NUMERIC, kitne_aadmi INT, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS delivery(id SERIAL PRIMARY KEY, shop_name TEXT, kya_bhejna TEXT, kahan_bhejna TEXT, shop_phone TEXT, shop_lat DOUBLE PRECISION, shop_lng DOUBLE PRECISION, km NUMERIC, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS payments(id SERIAL PRIMARY KEY, name TEXT, phone TEXT, plan TEXT, utr TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS reports(id SERIAL PRIMARY KEY, item_type TEXT, item_id INT, reported_by TEXT, reason TEXT, owner_phone TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    console.log('PaasWala Tables Ready');
  }catch(e){ console.log('db err', e.message); }
}
initDb();

// --- BASIC ---
app.get('/', (req,res)=> res.send('PaasWala Live Hai'));
app.get('/api/upi', (req,res)=> res.json({upi: UPI}));

// --- DOWNLOAD COUNT ---
app.post('/api/download', (req,res)=>{ downloadCount++; downloadToday++; res.json({ok:true, total: downloadCount}); });
app.get('/api/stats', (req,res)=> res.json({total_downloads: downloadCount, today: downloadToday}));

// --- ITEMS ---
app.post('/api/items', async (req,res)=>{
  try{ const {title,price,type,rent_type,area,phone,lat,lng,photo} = req.body; await pool.query(`INSERT INTO items(title,price,type,rent_type,area,phone,lat,lng,photo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[title,price,type,rent_type,area,phone,lat,lng,photo||'']); res.json({ok:true}); }catch(e){ res.json({ok:false, err:e.message}); }
});
app.get('/api/items', async (req,res)=>{
  try{ let {lat,lng} = req.query; lat=parseFloat(lat||22.3); lng=parseFloat(lng||73.18); let r = await pool.query(`SELECT *, (6371 * acos(cos(radians($1))*cos(radians(lat))*cos(radians(lng)-radians($2)) + sin(radians($1))*sin(radians(lat)))) AS dist FROM items ORDER BY dist ASC LIMIT 50`,[lat,lng]); res.json(r.rows.filter(x=>!x.dist || x.dist<=25)); }catch(e){ res.json([]); }
});

// --- WORKERS ---
app.post('/api/workers', async (req,res)=>{ try{ const {name,skill,charge,area,phone,lat,lng}=req.body; await pool.query(`INSERT INTO workers(name,skill,charge,area,phone,lat,lng) VALUES($1,$2,$3,$4,$5,$6,$7)`,[name,skill,charge,area,phone,lat,lng]); res.json({ok:true}); }catch(e){ res.json({ok:false}); } });

// --- MAZDOORI ---
app.post('/api/mazdoori', async (req,res)=>{ try{ const {kya_karwana,kab,paisa,kitne_aadmi,area,phone,lat,lng}=req.body; await pool.query(`INSERT INTO mazdoori(kya_karwana,kab,paisa,kitne_aadmi,area,phone,lat,lng) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[kya_karwana,kab,paisa,kitne_aadmi,area,phone,lat,lng]); res.json({ok:true}); }catch(e){ res.json({ok:false}); } });

// --- DELIVERY ---
app.post('/api/delivery', async (req,res)=>{ try{ const {shop_name,kya_bhejna,kahan_bhejna,shop_phone,shop_lat,shop_lng,km}=req.body; await pool.query(`INSERT INTO delivery(shop_name,kya_bhejna,kahan_bhejna,shop_phone,shop_lat,shop_lng,km) VALUES($1,$2,$3,$4,$5,$6,$7)`,[shop_name,kya_bhejna,kahan_bhejna,shop_phone,shop_lat,shop_lng,km]); res.json({ok:true}); }catch(e){ res.json({ok:false}); } });

// --- PAY ---
app.post('/api/pay', async (req,res)=>{
  try{
    const {name,phone,plan,utr}=req.body;
    let r = await pool.query(`INSERT INTO payments(name,phone,plan,utr) VALUES($1,$2,$3,$4) RETURNING id`,[name,phone,plan,utr]);
    let pid = r.rows[0].id;
    let text = `Naya Payment Aaya Hai\nNaam: ${name}\nPhone: ${phone}\nPlan: ${plan}\nUTR: ${utr}`;
    let kb = { inline_keyboard: [[{text:'✅ Accept', callback_data:'accept_'+pid},{text:'❌ Reject', callback_data:'reject_'+pid}]] };
    await sendTelegram(ADMIN_ID, text, kb);
    res.json({ok:true});
  }catch(e){ res.json({ok:false, err:e.message}); }
});

// --- REPORT ---
app.post('/api/report', async (req,res)=>{
  try{ const {item_type,item_id,reported_by,reason,owner_phone}=req.body; await pool.query(`INSERT INTO reports(item_type,item_id,reported_by,reason,owner_phone) VALUES($1,$2,$3,$4,$5)`,[item_type,item_id,reported_by,reason,owner_phone]); await sendTelegram(ADMIN_ID, `🚨 Naya Report\nItem: ${item_type} ${item_id}\nBy: ${reported_by}\nReason: ${reason}`); res.json({ok:true}); }catch(e){ res.json({ok:false}); }
});

// --- TELEGRAM WEBHOOK ---
app.post('/telegram', async (req,res)=>{
  try{
    let upd = req.body;
    // Button dabaya - Accept / Reject
    if(upd.callback_query){
      let data = upd.callback_query.data;
      let chatId = upd.callback_query.message.chat.id;
      if(data.startsWith('accept_')){
        let pid = data.replace('accept_','');
        await pool.query(`UPDATE payments SET status='accepted' WHERE id=$1`,[pid]);
        await sendTelegram(chatId, `✅ Accept Ho Gaya\nPayment ID: ${pid}`);
      }
      if(data.startsWith('reject_')){
        let pid = data.replace('reject_','');
        await pool.query(`UPDATE payments SET status='rejected' WHERE id=$1`,[pid]);
        await sendTelegram(chatId, `❌ Reject Ho Gaya\nPayment ID: ${pid}`);
      }
      return res.json({ok:true});
    }
    // Message aaya
    if(upd.message && upd.message.text){
      let text = upd.message.text.trim();
      let chatId = upd.message.chat.id;
      if(text === '/start'){
        await sendTelegram(chatId, `Namaste! PaasWala Bot Hai.\nPayment aane pe yahan msg aayega.\n/stat likho - Download dekhne ke liye.`);
      }
      if(text === '/stat'){
        let pr = await pool.query(`SELECT COUNT(*) as c FROM payments`);
        let payCount = pr.rows[0].c;
        let msg = `📊 PaasWala Stat\n\nTotal Download: ${downloadCount}\nAaj Download: ${downloadToday}\nTotal Payment: ${payCount}\n\nPaasWala Available - Hum aapki aaj kya seva kare?`;
        await sendTelegram(chatId, msg);
      }
    }
    res.json({ok:true});
  }catch(e){ res.json({ok:true}); }
});

// --- DAILY 10 AM AUTO STAT ---
setInterval(async ()=>{
  try{
    let now = new Date();
    let ist = new Date(now.getTime() + (5.5*60*60*1000));
    let h = ist.getUTCHours();
    let m = ist.getUTCMinutes();
    let today = ist.toDateString();
    if(h===10 && m===0 && lastStatDate !== today){
      lastStatDate = today;
      let msg = `☀️ Good Morning PaasWala!\n\nTotal Download: ${downloadCount}\nKal Download: ${downloadToday}\n\nAaj naya din, naya mauka!`;
      await sendTelegram(ADMIN_ID, msg);
      downloadToday = 0;
    }
  }catch(e){}
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('PaasWala Live on '+PORT));
