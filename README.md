<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Issues][issues-shield]][issues-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">Investly</h3>
  <p align="center">
    Your personal investing dashboard
    <br />
    <br />
    <a href="https://investly.dev">View Live</a>
    &middot;
    <a href="https://github.com/jenni4j/portfolio_tracker/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/jenni4j/portfolio_tracker/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

---

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

---

<!-- ABOUT THE PROJECT -->
## About The Project

<img width="1392" height="761" alt="Investly screenshot" src="https://github.com/user-attachments/assets/6d97f616-2830-4215-8ca1-a72da70abbbb" />

Investly is a personal investing dashboard that brings together your portfolios, watchlist, stock charts, and an AI assistant in one place.

Key features:
* **Home dashboard** — live snapshot of S&P 500, NASDAQ, Dow Jones, and Russell 2000, alongside your portfolio value and watchlist at a glance
* **Portfolio tracking** — track holdings across multiple portfolios with cost basis, current value, P&L ($), and return (%) per position
* **Watchlist** — monitor stocks you're watching and see how they've moved since you added them
* **Charts & metrics** — price history (1D to 5Y) and key financials (P/E, EPS, market cap, beta, revenue, margins, and more) for any stock
* **Benji** — an AI investing assistant powered by Claude that can answer questions about your holdings, look up any stock, and add entries to your portfolio or watchlist by chat

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

[![React][React-shield]][React-url]
[![TypeScript][TypeScript-shield]][TypeScript-url]
[![Vite][Vite-shield]][Vite-url]
[![TailwindCSS][Tailwind-shield]][Tailwind-url]
[![Node.js][Node-shield]][Node-url]
[![Express][Express-shield]][Express-url]
[![Supabase][Supabase-shield]][Supabase-url]
[![Anthropic][Anthropic-shield]][Anthropic-url]
[![Vercel][Vercel-shield]][Vercel-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- GETTING STARTED -->
## Getting Started

The project has two parts: a Vite + React frontend (`portfolio_tracker/`) and an Express API server (`server/`).

### Prerequisites

* Node.js 18+
* A [Supabase](https://supabase.com) project with `portfolios`, `stocks`, and `watchlist` tables
* An [Anthropic API key](https://console.anthropic.com) for the Benji assistant

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/jenni4j/portfolio_tracker.git
   cd portfolio_tracker
   ```

2. Install frontend dependencies
   ```sh
   cd portfolio_tracker
   npm install
   ```

3. Install server dependencies
   ```sh
   cd ../server
   npm install
   ```

4. Create `server/.env` with your credentials
   ```sh
   ANTHROPIC_API_KEY=your_anthropic_api_key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. Create `portfolio_tracker/src/lib/supabaseClient.ts` with your Supabase config
   ```ts
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");
   ```

6. Start the server
   ```sh
   cd server && npm run dev
   ```

7. Start the frontend (in a new terminal)
   ```sh
   cd portfolio_tracker && npm run dev
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- USAGE -->
## Usage

**Dashboard** — after logging in you land on the home page, which shows live index quotes and a snapshot of your portfolio and watchlist.

**Portfolio** — navigate to Portfolios to see all holdings with full P&L detail. Use the `+ Add` button to add a position manually, or ask Benji to add it for you.

**Watchlist** — navigate to Watchlist to track stocks without committing. Each entry shows how the price has moved since you added it.

**Charts** — search any ticker on the Charts page to see price history and key financial metrics. Use the `+ Watchlist` button to add directly from the chart view.

**Benji** — click the floating button in the bottom-right corner on any page. You can ask questions like:
- *"How is my portfolio doing?"*
- *"What's Apple's P/E ratio?"*
- *"Add 10 shares of NVDA at $120 to my main portfolio."*

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- ROADMAP -->
## Roadmap

- [x] Home dashboard with live market indices
- [x] Portfolio tracking with P&L and return %
- [x] Watchlist with change % since entry
- [x] Stock charts and key financial metrics
- [x] Benji — AI investing assistant
- [ ] Explore open-source LLMs beyond Anthropic models
- [ ] Improve mobile behavior
- [ ] Support for assets beyond equities (cash, crypto)
- [ ] News headlines for held stocks and watchlist
- [ ] Multi-currency support

See the [open issues](https://github.com/jenni4j/portfolio_tracker/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Yahoo Finance 2](https://github.com/gadicc/node-yahoo-finance2) — market data
* [Supabase](https://supabase.com) — authentication and database
* [Anthropic Claude](https://www.anthropic.com) — AI assistant (Benji)
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- MARKDOWN LINKS & IMAGES -->
[issues-shield]: https://img.shields.io/github/issues/jenni4j/portfolio_tracker.svg?style=for-the-badge
[issues-url]: https://github.com/jenni4j/portfolio_tracker/issues
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/jenniferjordache

[React-shield]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript-shield]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Vite-shield]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Tailwind-shield]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Node-shield]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
[Express-shield]: https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[Supabase-shield]: https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[Anthropic-shield]: https://img.shields.io/badge/Anthropic-191919?style=for-the-badge&logo=anthropic&logoColor=white
[Anthropic-url]: https://www.anthropic.com/
[Vercel-shield]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[Vercel-url]: https://vercel.com/
