import getEnv from "@/lib/env-entry"

export function getClientPollingInterval(fallback: number): number {
  const configured = Number.parseInt(getEnv("NEXT_PUBLIC_NezhaFetchInterval") || "", 10)
  return Number.isFinite(configured) ? configured : fallback
}
