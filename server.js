const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "919226946912";

if (!KEY_ID || !KEY_SECRET) {
  console.warn("Razorpay keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
}

const razorpay = new Razorpay({key_id: KEY_ID || "missing", key_secret: KEY_SECRET || "missing"});
const db = new Database(process.env.DB_PATH || path.join(__dirname, "darshan_setu.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  people INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
)
`);

const PRICES = {solo:1500, perPerson:1500, familyMax:10, familyPrice:13000};

function calculateAmount(people) {
  // Keep the existing site's ₹1,500/person pricing model.
  return people * PRICES.perPerson * 100;
}

function clean(s, max=200) {
  return String(s ?? "").trim().slice(0,max);
}

app.post("/api/create-order", async (req,res) => {
  try {
    if (!KEY_ID || !KEY_SECRET) return res.status(503).json({error:"Payment gateway is not configured yet."});
    const name=clean(req.body.name), phone=clean(req.body.phone,30), email=clean(req.body.email,160);
    const date=clean(req.body.date,20), timeSlot=clean(req.body.timeSlot,40);
    const people=Number(req.body.people);

    if(!name||!phone||!email||!date||!timeSlot||!Number.isInteger(people)||people<1||people>18)
      return res.status(400).json({error:"Please provide valid booking details."});

    const amount=calculateAmount(people);
    const bookingId="DS-"+Date.now()+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();

    const order=await razorpay.orders.create({
      amount, currency:"INR", receipt:bookingId, notes:{bookingId,name,date,timeSlot,people:String(people)}
    });

    db.prepare(`INSERT INTO bookings
      (id,name,phone,email,date,time_slot,people,amount,currency,razorpay_order_id,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(bookingId,name,phone,email,date,timeSlot,people,amount,"INR",order.id,"created");

    res.json({keyId:KEY_ID,orderId:order.id,amount,currency:"INR",bookingId});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"Unable to create the payment order."});
  }
});

app.post("/api/verify-payment", (req,res) => {
  try {
    const {bookingId,razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
    const booking=db.prepare("SELECT * FROM bookings WHERE id=?").get(bookingId);
    if(!booking || booking.razorpay_order_id!==razorpay_order_id)
      return res.status(400).json({error:"Booking/order mismatch."});

    const expected=crypto.createHmac("sha256",KEY_SECRET)
      .update(`${booking.razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if(expected!==razorpay_signature)
      return res.status(400).json({error:"Payment signature verification failed."});

    db.prepare(`UPDATE bookings SET razorpay_payment_id=?,status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(razorpay_payment_id,bookingId);

    // Send a WhatsApp confirmation link to the customer's number.
    const text=`Darshan Setu booking confirmed. Booking ID: ${bookingId}. Date: ${booking.date}, Time: ${booking.time_slot}, People: ${booking.people}, Paid: ₹${booking.amount/100}.`;
    const whatsapp=`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

    res.json({success:true,whatsapp});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"Unable to verify payment."});
  }
});

app.get("/api/booking/:id",(req,res)=>{
  const b=db.prepare("SELECT id,name,date,time_slot,people,amount,currency,status FROM bookings WHERE id=?").get(req.params.id);
  if(!b) return res.status(404).json({error:"Booking not found."});
  if(b.status!=="paid") return res.status(403).json({error:"Booking is not confirmed."});
  res.json(b);
});

app.get("/health",(req,res)=>res.json({ok:true}));

app.listen(PORT,()=>console.log(`Darshan Setu running on port ${PORT}`));
