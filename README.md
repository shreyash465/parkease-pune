# 🅿️ ParkEase Pune — Airbnb for Parking

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shreyash465/parkease-pune)

A peer-to-peer parking marketplace designed for **Pune, Maharashtra**. 

When residents leave for office, their designated society parking spot sits vacant for **8–10 hours**. ParkEase lets them monetize this idle space for **₹50–₹100/hr**, while nearby commuters, shoppers, and office-goers get guaranteed, safe, and covered parking near high-density hubs (Koregaon Park, FC Road, Hinjewadi, Viman Nagar Phoenix Mall, Baner, Kothrud, MG Road).

---

## ⚡ 1-Click Free Deployment

### 🟢 Deploy on Render (Free Tier)
Click the button below to deploy this entire full-stack application (Node.js + SQLite + Frontend) directly onto Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shreyash465/parkease-pune)

### 🟠 Deploy on Cloudflare Pages (Free)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Pages** > **Connect to Git**.
2. Select `shreyash465/parkease-pune`.
3. Set Build output directory to `public`.
4. Click **Save and Deploy**!

---

## 🚀 Key Features

- **🗺️ Interactive Pune Map (Leaflet & OpenStreetMap)**: Live pins with dynamic hourly pricing across 8 prime Pune localities.
- **🛡️ Gated Society Gate Pass**: Generates instant, verifiable digital QR entry passes with vehicle numbers (`MH12...`) and host resident verification for society security guards.
- **💳 Indian Checkout Simulator**: Full UPI (GPay / PhonePe / Paytm) and Debit/Credit Card flow with automated **15% platform commission** deduction.
- **📊 Host & Renter Dashboard**: Earnings metrics, spot listing manager, upcoming booking slots, and one-click gate pass printing.
- **⚙️ Admin Commission Analytics**: Real-time GMV, net payouts, platform profit tracking, and Pune locality revenue breakdown.

---

## 🗺️ Pune Pricing Benchmarks

| Locality | Hourly Rate | Vehicle Type | Landmark | Host Daily (8 hrs Net) |
|---|---|---|---|---|
| **Viman Nagar** | ₹100/hr | Car | Phoenix Marketcity | ₹680 |
| **Shivajinagar** | ₹90/hr | Car | Bus Stand / Metro | ₹612 |
| **Koregaon Park** | ₹80/hr | Car | Lane 5 / Osho Ashram | ₹544 |
| **Baner** | ₹70/hr | Car | Westend Mall | ₹476 |
| **FC Road** | ₹60/hr | Car | Fergusson College | ₹408 |
| **Kothrud** | ₹50/hr | Car | MIT College | ₹340 |
| **Hinjewadi Ph 1** | ₹30/hr | Bike | Infosys Circle | ₹204 |
| **MG Road** | ₹25/hr | Bike | Metro Station | ₹170 |

---

## 🔐 Demo Credentials

- **Email:** `rahul@demo.com`
- **Password:** `demo123`

---

## 🛠️ Local Development

```bash
git clone https://github.com/shreyash465/parkease-pune.git
cd parkease-pune
npm install
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
