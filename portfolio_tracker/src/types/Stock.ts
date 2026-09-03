import type { Momentum } from "./Momentum";

export interface Stock {
    id: number;
    ticker: string;
    name: string;
    description: string;
    industry?: string;
    lastPrice: number;
    initialPrice: number;
    shares: number;
    value: number;
    returnPct: number;
    pnl: number;
    currency?: string;
    momentum?: Momentum | null;
  }
