"use client"

import type React from "react"
import { use, useState } from "react"
import { NetworkChartClient } from "@/app/(main)/ClientComponents/detail/NetworkChart"
import ServerDetailChartClient from "@/app/(main)/ClientComponents/detail/ServerDetailChartClient"
import ServerDetailClient from "@/app/(main)/ClientComponents/detail/ServerDetailClient"
import { ServerAcceleratorList } from "@/app/(main)/ClientComponents/detail/ServerAcceleratorList"
import ServerDetailSummary from "@/app/(main)/ClientComponents/detail/ServerDetailSummary"
import ServerIPInfo from "@/app/(main)/ClientComponents/detail/ServerIPInfo"
import TabSwitch from "@/components/TabSwitch"
import { Separator } from "@/components/ui/separator"

type PageProps = {
  params: Promise<{ id: string }>
}

type TabType = "Detail" | "Accelerators"

export default function Page({ params }: PageProps) {
  const { id } = use(params)
  const serverId = Number(id)

  const tabs: TabType[] = ["Detail", "Accelerators"]
  const disabledTabs: TabType[] = []
  const [currentTab, setCurrentTab] = useState<TabType>(tabs[0])

  // Handle tab switching - prevent switching to disabled tabs
  const handleTabSwitch = (tab: string) => {
    if (!disabledTabs.includes(tab as TabType)) {
      setCurrentTab(tab as TabType)
    }
  }

  const tabContent: Record<TabType, React.ReactNode> = {
    Detail: <ServerDetailChartClient server_id={serverId} show={currentTab === "Detail"} />,
    Accelerators: <ServerAcceleratorList server_id={serverId} />,
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-2">
      <ServerDetailClient server_id={serverId} />

      {/* Always show tab navigation */}
      <nav className="my-2 flex w-full items-center">
        <Separator className="flex-1" />
        <div className="flex w-full max-w-[200px] justify-center">
          <TabSwitch
            tabs={tabs}
            currentTab={currentTab}
            setCurrentTab={handleTabSwitch}
            disabledTabs={disabledTabs}
          />
        </div>
        <Separator className="flex-1" />
      </nav>

      {/* detail lists */}
      <section>
        <ServerDetailSummary server_id={serverId} />
      </section>

      {tabContent[currentTab]}
    </main>
  )
}
