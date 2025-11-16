import Link from "next/link"
import { useTranslations } from "next-intl"
import ServerFlag from "@/components/ServerFlag"
import ServerUsageBar from "@/components/ServerUsageBar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { NezhaAPISafe } from "@/lib/drivers/types"
import getEnv from "@/lib/env-entry"
import { GetFontLogoClass, GetOsName, MageMicrosoftWindows } from "@/lib/logo-class"
import { cn, formatBytes, formatNezhaInfo } from "@/lib/utils"

export default function ServerCard({ serverInfo }: { serverInfo: NezhaAPISafe }) {
  const t = useTranslations("ServerCard")
  const {
    id,
    name,
    country_code,
    online,
    cpu,
    mem,
    stg,
    host,
    gpu,
    gpu_memory_percent,
    gpu_memory_used,
    gpu_memory_total,
  } = formatNezhaInfo(serverInfo)

  const showFlag = getEnv("NEXT_PUBLIC_ShowFlag") === "true"
  const showNetTransfer = getEnv("NEXT_PUBLIC_ShowNetTransfer") === "true"
  const fixedTopServerName = getEnv("NEXT_PUBLIC_FixedTopServerName") === "true"

  const saveSession = () => {
    sessionStorage.setItem("fromMainPage", "true")
  }

  return online ? (
    <Link onClick={saveSession} href={`/server/${id}`} prefetch={true}>
      <Card
        className={cn(
          "flex cursor-pointer flex-col items-center justify-start gap-3 p-3 hover:border-stone-300 hover:shadow-md md:px-5 dark:hover:border-stone-700",
          {
            "flex-col": fixedTopServerName,
            "lg:flex-row": !fixedTopServerName,
          },
        )}
      >
        <section
          className={cn("grid items-center gap-2", {
            "lg:w-40": !fixedTopServerName,
          })}
          style={{ gridTemplateColumns: "auto auto 1fr" }}
        >
          <span className="h-2 w-2 shrink-0 self-center rounded-full bg-green-500" />
          <div
            className={cn(
              "flex items-center justify-center",
              showFlag ? "min-w-[17px]" : "min-w-0",
            )}
          >
            {showFlag ? <ServerFlag country_code={country_code} /> : null}
          </div>
          <div className="relative">
            <p
              className={cn(
                "break-normal font-bold tracking-tight",
                showFlag ? "text-xs" : "text-sm",
              )}
            >
              {name}
            </p>
          </div>
        </section>
        <div className="flex flex-col gap-2">
          <section
            className={cn("grid grid-cols-5 items-center gap-3", {
              "lg:grid-cols-6 lg:gap-4": fixedTopServerName,
            })}
          >
            {fixedTopServerName && (
              <div className={"col-span-1 hidden items-center gap-2 lg:flex lg:flex-row"}>
                <div className="font-semibold text-xs">
                  {host.Platform.includes("Windows") ? (
                    <MageMicrosoftWindows className="size-2.5" />
                  ) : (
                    <p className={`fl-${GetFontLogoClass(host.Platform)}`} />
                  )}
                </div>
                <div className={"flex w-14 flex-col"}>
                  <p className="text-muted-foreground text-xs">{t("System")}</p>
                  <div className="flex items-center font-semibold text-[10.5px]">
                    {host.Platform.includes("Windows") ? "Windows" : GetOsName(host.Platform)}
                  </div>
                </div>
              </div>
            )}
            <div className={"flex w-14 flex-col"}>
              <p className="text-muted-foreground text-xs">{t("CPU")}</p>
              <div className="flex items-center font-semibold text-xs">{cpu.toFixed(2)}%</div>
              <ServerUsageBar value={cpu} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-muted-foreground text-xs">{t("Mem")}</p>
              <div className="flex items-center font-semibold text-xs">{mem.toFixed(2)}%</div>
              <ServerUsageBar value={mem} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-muted-foreground text-xs">{t("STG")}</p>
              <div className="flex items-center font-semibold text-xs">{stg.toFixed(2)}%</div>
              <ServerUsageBar value={stg} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-muted-foreground text-xs">{t("GpuMemory")}</p>
              <div className="flex items-center justify-between font-semibold text-[11px]">
                <span>{gpu_memory_percent.toFixed(1)}%</span>
              </div>
              <ServerUsageBar value={gpu_memory_percent} />
            </div>
            <div className={"flex w-14 flex-col"}>
              <p className="text-muted-foreground text-xs">{t("GpuUtil")}</p>
              <div className="flex items-center font-semibold text-xs">{gpu.toFixed(1)}%</div>
              <ServerUsageBar value={gpu} />
            </div>
          </section>
          {showNetTransfer && (
            <section className={"flex items-center justify-between gap-1"}>
              <Badge
                variant="secondary"
                className="flex-1 items-center justify-center text-nowrap rounded-[8px] border-muted-50 text-[11px] shadow-md shadow-neutral-200/30 dark:shadow-none"
              >
                {t("GpuMemory")}:{formatBytes(gpu_memory_used)}
              </Badge>
              <Badge
                variant="outline"
                className="flex-1 items-center justify-center text-nowrap rounded-[8px] text-[11px] shadow-md shadow-neutral-200/30 dark:shadow-none"
              >
                {t("GpuCapacity")}:{formatBytes(gpu_memory_total)}
              </Badge>
            </section>
          )}
        </div>
      </Card>
    </Link>
  ) : (
    <Link onClick={saveSession} href={`/server/${id}`} prefetch={true}>
      <Card
        className={cn(
          "flex cursor-pointer flex-col items-center justify-start gap-3 p-3 hover:border-stone-300 hover:shadow-md md:px-5 dark:hover:border-stone-700",
          showNetTransfer ? "min-h-[123px] lg:min-h-[91px]" : "min-h-[93px] lg:min-h-[61px]",
          {
            "flex-col": fixedTopServerName,
            "lg:flex-row": !fixedTopServerName,
          },
        )}
      >
        <section
          className={cn("grid items-center gap-2", {
            "lg:w-40": !fixedTopServerName,
          })}
          style={{ gridTemplateColumns: "auto auto 1fr" }}
        >
          <span className="h-2 w-2 shrink-0 self-center rounded-full bg-red-500" />
          <div
            className={cn(
              "flex items-center justify-center",
              showFlag ? "min-w-[17px]" : "min-w-0",
            )}
          >
            {showFlag ? <ServerFlag country_code={country_code} /> : null}
          </div>
          <div className="relative">
            <p
              className={cn(
                "break-normal font-bold tracking-tight",
                showFlag ? "text-xs" : "text-sm",
              )}
            >
              {name}
            </p>
          </div>
        </section>
      </Card>
    </Link>
  )
}
