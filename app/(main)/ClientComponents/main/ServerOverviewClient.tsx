"use client"

import { ArrowUpCircleIcon } from "@heroicons/react/20/solid"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useFilter } from "@/app/context/network-filter-context"
import { useServerData } from "@/app/context/server-data-context"
import { useStatus } from "@/app/context/status-context"
import AnimateCountClient from "@/components/AnimatedCount"
import { Loader } from "@/components/loading/Loader"
import { Card, CardContent } from "@/components/ui/card"
import getEnv from "@/lib/env-entry"
import { cn, formatBytes, formatNezhaInfo } from "@/lib/utils"
import blogMan from "@/public/blog-man.webp"

export default function ServerOverviewClient() {
  const { data, error, isLoading } = useServerData()
  const { status, setStatus } = useStatus()
  const t = useTranslations("ServerOverviewClient")
  const disableCartoon = getEnv("NEXT_PUBLIC_DisableCartoon") === "true"
  const idleThresholdPercent = Number(getEnv("NEXT_PUBLIC_FreeGpuMemoryPercent") ?? "10")
  const totalGpuMemory = data?.total_gpu_memory ?? 0
  const totalGpuMemoryUsedValue = data?.total_gpu_memory_used ?? 0
  const averageGpuUtilization = data?.average_gpu_utilization ?? 0
  const gpuMemoryPercent =
    totalGpuMemory > 0 ? Number(((totalGpuMemoryUsedValue / totalGpuMemory) * 100).toFixed(2)) : 0

  const accelerators = data?.result
    ?.flatMap((server) => formatNezhaInfo(server).accelerators ?? [])
    .filter(Boolean) ?? []
  const totalAcceleratorCount = accelerators.length
  const idleAcceleratorCount = accelerators.filter((accelerator) => {
    const used = accelerator.memoryUsedBytes ?? 0
    const total = accelerator.memoryTotalBytes ?? 0
    const percent = accelerator.memoryUtilization ?? (total > 0 ? (used / total) * 100 : 0)
    return percent < idleThresholdPercent
  }).length

  if (error) {
    const errorInfo = error as any
    return (
      <div className="flex flex-col items-center justify-center">
        <p className="font-medium text-sm opacity-40">
          Error status:{errorInfo?.status} {errorInfo.info?.cause ?? errorInfo?.message}
        </p>
        <p className="font-medium text-sm opacity-40">{t("error_message")}</p>
      </div>
    )
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card
          className={cn("group cursor-default transition-all border-purple-200/40 dark:border-purple-500/30")}
        >
          <CardContent className="flex h-full items-center px-6 py-3">
            <section className="flex flex-col gap-1">
              <p className="font-medium text-sm md:text-base">{t("accelerator_total")}</p>
              <div className="flex min-h-7 items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
                </span>
                {data?.result ? (
                  <div className="font-semibold text-lg">
                    <AnimateCountClient count={totalAcceleratorCount} />
                  </div>
                ) : (
                  <div className="flex h-7 items-center">
                    <Loader visible={true} />
                  </div>
                )}
              </div>
            </section>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-default ring-1 ring-transparent transition-all",
            {
              "ring-green-500": status === "online",
            },
          )}
        >
          <CardContent className="flex h-full items-center px-6 py-3">
            <section className="flex flex-col gap-1">
              <p className="font-medium text-sm md:text-base">
                {t("accelerator_idle")}
              </p>
              <div className="flex min-h-7 items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                {data?.result ? (
                  <div className="font-semibold text-lg">
                    <AnimateCountClient count={idleAcceleratorCount} />
                  </div>
                ) : (
                  <div className="flex h-7 items-center">
                    <Loader visible={true} />
                  </div>
                )}
              </div>
            </section>
          </CardContent>
        </Card>
        <Card className="group cursor-default ring-1 ring-transparent">
          <CardContent className="relative flex h-full items-center px-6 py-3">
            <section className="flex w-full flex-col gap-2">
              <div className="flex w-full items-center justify-between">
                <p className="font-medium text-sm md:text-base">{t("accelerator_vram")}</p>
              </div>
              {data?.result ? (
                <>
                  <section className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <p className="text-nowrap">
                        {formatBytes(totalGpuMemoryUsedValue)} / {formatBytes(totalGpuMemory)}
                      </p>
                      <span className="text-muted-foreground text-xs">{gpuMemoryPercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all"
                        style={{ width: `${Math.min(gpuMemoryPercent, 100)}%` }}
                      />
                    </div>
                  </section>
                </>
              ) : (
                <div className="flex h-[38px] items-center">
                  <Loader visible={true} />
                </div>
              )}
            </section>
          </CardContent>
        </Card>
        <Card className="cursor-default">
          <CardContent className="flex h-full items-center px-6 py-3">
            <section className="flex w-full flex-col gap-2">
              <p className="font-medium text-sm md:text-base">{t("accelerator_utilization")}</p>
              {data?.result ? (
                <div className="flex items-end gap-3">
                  <p className="text-xl font-semibold">{averageGpuUtilization.toFixed(1)}%</p>
                </div>
              ) : (
                <div className="flex h-[38px] items-center">
                  <Loader visible={true} />
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </section>
      {data?.result === undefined && !isLoading && (
        <div className="flex flex-col items-center justify-center">
          <p className="font-medium text-sm opacity-40">{t("error_message")}</p>
        </div>
      )}
    </>
  )
}
