"use client"

import type React from "react"
import { useTranslations } from "next-intl"
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import useSWR from "swr"
import NetworkChartLoading from "@/components/loading/NetworkChartLoading"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { getClientPollingInterval } from "@/lib/polling"
import { formatBytes, formatRelativeTime, nezhaFetcher } from "@/lib/utils"

type AcceleratorHistoryPoint = {
  recordedAt: string
  gpuUtilization: number
  gpuMemoryUsedBytes: number
  gpuMemoryTotalBytes: number
  powerWatts?: number
}

type ChartPoint = {
  timeStamp: number
  gpuUtilization: number
  memoryPercent: number
  memoryUsed: number
  memoryTotal: number
  powerWatts: number
}

export function NetworkChartClient({
  server_id,
  show,
}: {
  server_id: number
  show: boolean
}) {
  const t = useTranslations("NetworkChartClient")
  const refreshInterval = getClientPollingInterval(15000)

  const { data, error } = useSWR<AcceleratorHistoryPoint[]>(
    `/api/monitor?server_id=${server_id}`,
    nezhaFetcher,
    {
      refreshInterval,
      isVisible: () => show,
    },
  )

  if (error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center">
          <p className="font-medium text-sm opacity-40">{error.message}</p>
          <p className="font-medium text-sm opacity-40">{t("chart_fetch_error_message")}</p>
        </div>
        <NetworkChartLoading />
      </>
    )
  }

  if (!data) return <NetworkChartLoading />

  const chartData: ChartPoint[] = data.map((point) => ({
    timeStamp: new Date(point.recordedAt).getTime(),
    gpuUtilization: Number(point.gpuUtilization ?? 0),
    memoryPercent:
      point.gpuMemoryTotalBytes > 0
        ? Number(((point.gpuMemoryUsedBytes / point.gpuMemoryTotalBytes) * 100).toFixed(2))
        : 0,
    memoryUsed: point.gpuMemoryUsedBytes,
    memoryTotal: point.gpuMemoryTotalBytes,
    powerWatts: point.powerWatts ?? 0,
  }))

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <HistoryCard
        title={t("GpuMemoryHistory")}
        description={t("GpuMemoryHistoryDescription")}
        data={chartData}
        dataKey="memoryPercent"
        chartConfig={{
          memoryPercent: {
            label: t("GpuMemory"),
          },
        }}
        summary={(point) => (
          <span className="text-xs text-muted-foreground">
            {formatBytes(point.memoryUsed)} / {formatBytes(point.memoryTotal)}
          </span>
        )}
      >
        {(config) => (
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 12,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timeStamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={200}
              interval="preserveStartEnd"
              tickFormatter={(value) => formatRelativeTime(value)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              mirror={true}
              tickMargin={-15}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel unit="%" />}
            />
            <Area
              isAnimationActive={false}
              dataKey="memoryPercent"
              type="linear"
              fill={config.memoryPercent?.color ?? "hsl(var(--chart-1))"}
              fillOpacity={0.2}
              stroke={config.memoryPercent?.color ?? "hsl(var(--chart-1))"}
            />
          </AreaChart>
        )}
      </HistoryCard>
      <HistoryCard
        title={t("GpuUtilHistory")}
        description={t("GpuUtilHistoryDescription")}
        data={chartData}
        dataKey="gpuUtilization"
        chartConfig={{
          gpuUtilization: {
            label: t("GpuUtil"),
          },
        }}
        summary={(point) => (
          point.powerWatts > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("Power")}: {point.powerWatts}W
            </span>
          )
        )}
      >
        {(config) => (
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 12,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timeStamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={200}
              interval="preserveStartEnd"
              tickFormatter={(value) => formatRelativeTime(value)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              mirror={true}
              tickMargin={-15}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel unit="%" />}
            />
            <Line
              isAnimationActive={false}
              dataKey="gpuUtilization"
              type="linear"
              stroke={config.gpuUtilization?.color ?? "hsl(var(--chart-2))"}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        )}
      </HistoryCard>
    </section>
  )
}

type HistoryCardProps = {
  title: string
  description: string
  data: ChartPoint[]
  dataKey: keyof ChartPoint
  chartConfig: ChartConfig
  children: (config: ChartConfig) => React.ReactNode
  summary?: (point: ChartPoint) => React.ReactNode
}

function HistoryCard({
  title,
  description,
  data,
  dataKey,
  chartConfig,
  children,
  summary,
}: HistoryCardProps) {
  const latest = data[data.length - 1]
  const latestValue = latest ? (latest[dataKey] as number) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <p className="text-foreground text-lg font-semibold">{latestValue.toFixed(1)}%</p>
        {latest && summary?.(latest)}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          {children(chartConfig)}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
