export function formatCoins(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function coinsToUsd(n: number, coinsPerUsd: number): number {
  if (!coinsPerUsd) return 0;
  return n / coinsPerUsd;
}

const TX_LABELS: Record<string, string> = {
  ad_reward: "Ad reward",
  referral_bonus: "Referral bonus",
  withdrawal: "Withdrawal",
  withdrawal_refund: "Withdrawal refund",
  streak_bonus: "Daily check-in",
  mission_reward: "Mission reward",
  spin_reward: "Lucky Spin",
  admin_adjust: "Adjustment",
};

export function txLabel(type: string): string {
  return TX_LABELS[type] ?? type;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
