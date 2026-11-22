# 🚀 Free Deployment Guide: GitHub & Render

Your ParkEase repository is already initialized and committed locally with a pre-configured `render.yaml` Blueprint.

---

## Step 1: Push to GitHub

1. Go to [github.com/new](https://github.com/new)
2. Create a new repository named `parkease-pune` (leave "Initialize this repository with README" unchecked).
3. Copy your repository URL (e.g., `https://github.com/<your-username>/parkease-pune.git`).
4. In your terminal (or share the URL/token with me to run it for you):
   ```bash
   cd C:\Users\oujgi\.gemini\antigravity\scratch\parking-airbnb
   git branch -M main
   git remote add origin https://github.com/<your-username>/parkease-pune.git
   git push -u origin main
   ```

---

## Step 2: Deploy Free on Render (Instant Blueprint)

Once pushed to GitHub:

1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** at the top right.
3. Select **Blueprint** (or **Web Service**).
4. Connect your `parkease-pune` repository.
5. Render will automatically detect `render.yaml` and pre-fill everything:
   - **Environment:** Node
   - **Plan:** Free ($0/month)
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Click **Apply** or **Create Web Service**.
7. In ~60 seconds, your backend and frontend will be live on a free `.onrender.com` URL!

---

## Step 3: Cloudflare Pages (Alternative Static Host)

If you prefer Cloudflare:
- You can connect the same GitHub repo in **Cloudflare Pages** (Build output: `public/`).
- Or upload the pre-built `parkease-pune-cloudflare-pages.zip` directly via drag-and-drop.
