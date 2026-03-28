# Cloudflare Edge Latency Analytics

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/cf-latency-analytics)

A powerful, open-source dashboard that visualizes your Cloudflare Edge latency, origin response times, and request volume dynamically directly from the Cloudflare GraphQL Analytics API. 

## ✨ Features
* **Zero-Setup Deployment:** Comes pre-configured for Cloudflare Workers. 
* **Dynamic Grouping:** Group your analytics by specific API endpoint or `cacheStatus`.
* **Deep Inspect:** Custom filters for Data Center (IATA), Country (ISO), HTTP Method, Request Host, and specific route exclusions.
* **Smart Polling:** Selectable granularities (5m, 15m, 1h, 3h, 1d) with automated optimized grouping to sidestep Cloudflare GraphQL row limits.

## 🚀 One-Click Deploy (Easiest)
Click the "**Deploy to Cloudflare Workers**" badge above! It will automatically prompt you to log into Cloudflare and provide your Worker secrets without touching any code.

---

## 💻 Manual Setup & Deployment 

If you prefer to deploy from your terminal:

### 1. Requirements
- Node.js installed
- A Cloudflare Account and an [API Token](https://dash.cloudflare.com/profile/api-tokens) with `Zone Analytics: Read` and `Zone: Read` permissions.
- The `Zone ID` of the domain you wish to monitor.

### 2. Install Dependencies
Clone the repository and install standard dependencies:
```bash
git clone https://github.com/your-username/cf-latency-analytics.git
cd cf-latency-analytics
npm install
```

### 3. Deploy
Just run the interactive deploy command. Wrangler will prompt you to authenticate with Cloudflare and automatically handle building the React frontend and uploading the worker:
```bash
npm run deploy
```

### 4. Configure Secrets
Once deployed, head to your Cloudflare Dashboard -> Workers & Pages -> your new worker -> Settings -> Variables and Secrets.
Add the following secrets:
- `CLOUDFLARE_API_TOKEN`: Your API token.
- `CLOUDFLARE_ZONE_ID`: The Zone ID from your domain overview.

That's it! Visit your Worker's deployed URL to see your dashboard.

---

## 🛠️ Local Development

If you want to run the project locally to modify the UI or backend:

1. Create a `.dev.vars` file in the root of the project (see `.dev.vars.example`).
2. Add your secrets to `.dev.vars`:
```env
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=your_zone
```
3. Run the development server (serves frontend and backend simultaneously):
```bash
npm run dev
```

## 📄 License
MIT License. See `LICENSE` for details.
