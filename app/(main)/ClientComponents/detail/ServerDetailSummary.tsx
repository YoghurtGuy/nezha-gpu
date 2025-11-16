"use client"

import { useServerData } from "@/app/context/server-data-context"
import { Progress } from "@/components/ui/progress"
import { formatBytes, formatNezhaInfo } from "@/lib/utils"

export default function ServerDetailSummary({ server_id }: { server_id: number }) {
  const { data: serverList, error } = useServerData()

  const data = serverList?.result?.find((item) => item.id === server_id)

  if (error || !data) {
    return null
  }

  const {
    cpu,
    gpu,
    mem,
    disk,
    tcp,
    udp,
    process,
    gpu_memory_percent,
    gpu_memory_used,
    gpu_memory_total,
  } = formatNezhaInfo(data)

  return (
    <div className="mb-2 flex flex-wrap items-center gap-4">
      <section className="flex w-24 flex-col justify-center gap-1 px-1.5 py-1">
        <section className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">CPU</span>
          <span className="font-medium text-[10px]">{cpu.toFixed(2)}%</span>
        </section>
        <UsageBar value={cpu} />
      </section>
      <section className="flex w-24 flex-col justify-center gap-1 px-1.5 py-1">
        <section className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">GPU</span>
          <span className="font-medium text-[10px]">{gpu.toFixed(2)}%</span>
        </section>
        <UsageBar value={gpu} />
      </section>
      <section className="flex w-28 flex-col justify-center gap-1 px-1.5 py-1">
        <section className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">VRAM</span>
          <span className="font-medium text-[10px]">{gpu_memory_percent.toFixed(1)}%</span>
        </section>
        <UsageBar value={gpu_memory_percent} />
        {/* <span className="text-muted-foreground text-[10px]">
          {formatBytes(gpu_memory_used)} / {formatBytes(gpu_memory_total)}
        </span> */}
      </section>
      <section className="flex w-24 flex-col justify-center gap-1 px-1.5 py-1">
        <section className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Mem</span>
          <span className="font-medium text-[10px]">{mem.toFixed(2)}%</span>
        </section>
        <UsageBar value={mem} />
      </section>
      <section className="flex w-24 flex-col justify-center gap-1 px-1.5 py-1">
        <section className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Disk</span>
          <span className="font-medium text-[10px]">{disk.toFixed(2)}%</span>
        </section>
        <UsageBar value={disk} />
      </section>
    </div>
  )
}

type UsageBarProps = {
  value: number
}

function UsageBar({ value }: UsageBarProps) {
  return (
    <Progress
      aria-label={"Server Usage Bar"}
      aria-labelledby={"Server Usage Bar"}
      value={value}
      indicatorClassName={value > 90 ? "bg-red-500" : value > 70 ? "bg-orange-400" : "bg-green-500"}
      className={"h-[3px] rounded-sm bg-stone-200 dark:bg-stone-800"}
    />
  )
}
