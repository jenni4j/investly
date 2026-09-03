export interface Momentum {
  status: "positive" | "neutral" | "negative";
  score: number;
  fiveDayReturn: number;
  priceVsEma10: number;
  ema5VsEma10: number;
  explanation: string;
}
