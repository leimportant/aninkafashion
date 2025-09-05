# AninkaFashion – Accelerate with Llama: Smart Fashion for Resellers

## 🚀 Overview
AninkaFashion is an AI-powered fashion ecosystem designed to support small fashion owners and resellers.  
It helps owners calculate production costs (COGS) and manage workflows, enables resellers to easily browse products and confirm transactions without waiting for slow admin responses, and enhances customer experience with Llama AI for personalized recommendations, virtual try-on, and smart sizing.

## ✨ Key Features
- **Production Management** → automatic COGS calculation, order progress tracking, and material management.  
- **Reseller Access** → instant product discovery, simple ordering, and transparent transaction updates.  
- **Llama AI Chatbot** → product Q&A, personal stylist, smart sizing, and virtual try-on.  
- **Integrated POS** → sync offline & online sales, with multiple payment methods.  
- **Progressive Web App (PWA)** → lightweight, fast, offline-ready, and cross-platform.  

## 🛠 Tech Stack
- **Web App (PWA):** Laravel, Inertia, TypeScript, Tailwind CSS  
- **Chatbot AI:** Node.js, Groq API (Llama)  
- **Platform:** Progressive Web App (PWA)  

## ⚡ How to Run

### Web App
```bash
git clone https://github.com/leimportant/konveksi-starter.git
cd konveksi-starter

# install dependencies
npm install
composer install

# run development
npm run dev
php artisan serve

Chatbot AI
git clone https://github.com/leimportant/aninkafashion.git
cd aninkafashion

# install dependencies
npm install

# run chatbot
npm run dev

.env example
PORT=3000
GROQ_MODEL=llama-3.1-8b-instant
GROQ_API_KEY=your_groq_api_key
ANINKA_APP_KEY=your_laravel_app_key
ANINKA_APP_URL=http://localhost:8000

```
## 📅 Roadmap

0–6 months: MVP with POS, COGS calculator, basic chatbot (FAQ).

6–12 months: Virtual try-on, AI size recommendations, reseller system.

12–18 months: AI fashion trend analysis and data monetization.


## 📄 Documentation
- Business Proposal : [Business_Proposal_AninkaFashion_Llama.pdf](https://github.com/leimportant/aninkafashion/blob/docs/Business_Proposal_AninkaFashion_Llama.pdf)  



## 🔗 Repositories
- **Main Repo (Docs + Chatbot AI):** [aninkafashion](https://github.com/leimportant/aninkafashion)  
- **Web App (PWA):** [konveksi-starter](https://github.com/leimportant/konveksi-starter)  


