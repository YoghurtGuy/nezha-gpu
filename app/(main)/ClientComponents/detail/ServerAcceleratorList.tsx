"use client"

import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useServerData } from "@/app/context/server-data-context"
import { Card } from "@/components/ui/card"
import ServerUsageBar from "@/components/ServerUsageBar"
import { cn, formatBytes, formatNezhaInfo } from "@/lib/utils"

export function ServerAcceleratorList({ server_id }: { server_id: number }) {
  const t = useTranslations("ServerDetailClient")
  const { data: serverList } = useServerData()
  const serverData = serverList?.result?.find((item) => item.id === server_id)

  if (!serverData) {
    return null
  }

  const { accelerators } = formatNezhaInfo(serverData)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (!accelerators || accelerators.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-sm">{t("AcceleratorsTitle")}</h3>
      <div className="space-y-2">
        {accelerators.map((accelerator) => {
          const key = `${accelerator.slot}-${accelerator.name}`
          const isExpanded = expanded[key]
          return (
            <article
              key={key}
              className="rounded-2xl border border-muted-foreground/20 bg-card/30 px-4 py-3"
            >
              <button
                type="button"
                className="flex w-full flex-wrap items-start gap-4 text-left"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }))
                }
              >
                <div className="flex min-w-[200px] flex-col gap-1">
                  <p className="font-semibold text-sm leading-tight">{accelerator.name}</p>
                  <p className="text-muted-foreground text-[11px] uppercase">
                    #{accelerator.slot} · {accelerator.kind}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap gap-4">
                <UsageColumn
                  label={t("GpuMemory")}
                  value={`${formatBytes(accelerator.memoryUsedBytes)} / ${formatBytes(accelerator.memoryTotalBytes)}`}
                  percent={accelerator.memoryUtilization ?? 0}
                />
                <UsageColumn
                  label={t("GpuUtil")}
                  value={`${(accelerator.utilization ?? 0).toFixed(1)}%`}
                  percent={accelerator.utilization ?? 0}
                />
                <SummaryPill label={t("Processes")} value={`${accelerator.processes.length}`} />
                {accelerator.powerWatts !== undefined && (
                  <SummaryPill label={t("Power")} value={`${accelerator.powerWatts} W`} />
                )}
                  {accelerator.temperatureC !== undefined && (
                    <SummaryPill label={t("Temperature")} value={`${accelerator.temperatureC}°C`} />
                  )}
                </div>
                <ChevronDownIcon
                  className={cn(
                    "ml-auto size-5 text-muted-foreground transition-transform",
                    {
                      "rotate-180": isExpanded,
                    },
                  )}
                />
              </button>
              {isExpanded && accelerator.processes.length > 0 && (
                <section className="mt-3 rounded-xl border border-muted-foreground/15 p-2">
                  <p className="text-muted-foreground text-[11px] uppercase">{t("Processes")}</p>
                  <div className="mt-1 space-y-1 text-xs">
                    {accelerator.processes.map((proc) => (
                      <div
                        key={`${accelerator.slot}-${proc.pid ?? proc.name}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-2 py-1"
                      >
                        <span className="font-semibold">{proc.name}</span>
                        <span className="text-muted-foreground">{proc.user ?? "—"}</span>
                        <span className="font-medium">
                          {proc.memoryBytes ? formatBytes(proc.memoryBytes) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function UsageColumn({ label, value, percent }: { label: string; value: string; percent: number }) {
  const clamped = Math.min(Math.max(percent ?? 0, 0), 100)
  return (
    <div className="flex w-28 flex-col">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex items-center font-semibold text-xs">{value}</div>
      <ServerUsageBar value={clamped} />
    </div>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-24 flex-col">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</span>
      <span className="font-medium text-xs">{value}</span>
    </div>
  )
}
