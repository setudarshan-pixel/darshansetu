DARSHAN SETU — FULL BOOKING + PAYMENT DEPLOYMENT

This package adds:
- Real booking record creation
- 48 time slots covering 24 hours in 30-minute intervals (12:00 AM through 11:30 PM)
- Razorpay Orders API
- Razorpay Standard Checkout
- Server-side payment signature verification
- Paid booking confirmation page
- SQLite booking database
- WhatsApp confirmation destination
- Health endpoint

IMPORTANT SETUP
1. Create a Razorpay account and generate TEST API keys.
2. Copy .env.example to .env and enter:
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
3. Run:
   npm install
   npm start
4. Test the complete payment flow with Razorpay Test Mode.
5. For production, use LIVE keys only after completing Razorpay's go-live requirements.
6. Keep RAZORPAY_KEY_SECRET server-side. Never put it in index.html.
7. Configure HTTPS on your hosting.

PRICING
The current website's pricing model is retained: ₹1,500 per person.
The Family Pack display remains ₹13,000 for up to 10 people, but the current
booking calculator follows the existing site's per-person calculation.
If the actual family package should charge a flat ₹13,000, change calculateAmount()
in server.js before launch.

CONFIRMATION
After successful signature verification, the customer is redirected to:
 /confirmation.html?booking=...
The page fetches the paid booking from the server.

WEBHOOKS
For production-grade reliability, configure Razorpay webhooks for payment events
and use them as the authoritative asynchronous status mechanism. The current
handler verifies the checkout signature immediately; webhooks should be added
before high-volume production use.

The Razorpay docs require creating an order server-side, passing its order_id to
Checkout, and verifying the payment signature server-side. See:
https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
