import type {
  AcceleratorDevice,
  AcceleratorProcess,
  AcceleratorSnapshot,
  Device,
  DeviceSnapshot,
  LabUser,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  AcceleratorStatus,
  DriverCapabilities,
  NezhaAPI,
  NezhaAPISafe,
  ServerApi,
} from "./drivers/types"

const OFFLINE_THRESHOLD_MS = 1000 * 60 * 15

type SnapshotWithAccelerators = DeviceSnapshot & {
  accelerators: (AcceleratorSnapshot & {
    processes: (AcceleratorProcess & { labUser: LabUser | null })[]
    acceleratorDevice: AcceleratorDevice | null
  })[]
}

type DeviceWithSnapshot = Device & {
  snapshots: SnapshotWithAccelerators[]
}

export type LabMonitorPoint = {
  recordedAt: string
  gpuUtilization: number
  gpuMemoryUsedBytes: number
  gpuMemoryTotalBytes: number
  powerWatts?: number
}

const LAB_CAPABILITIES: DriverCapabilities = {
  supportsMonitoring: true,
  supportsRealTimeData: true,
  supportsHistoricalData: true,
  supportsIpInfo: true,
  supportsPacketLoss: false,
  supportsAlerts: false,
}

function bigintToNumber(value?: bigint | null): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function bigintToNumberOrUndefined(value?: bigint | null): number | undefined {
  if (value === null || value === undefined) return undefined
  return Number(value)
}

function isSnapshotFresh(snapshot?: SnapshotWithAccelerators): boolean {
  if (!snapshot) return false
  return Date.now() - snapshot.recordedAt.getTime() <= OFFLINE_THRESHOLD_MS
}

function mapAccelerator(
  accel: SnapshotWithAccelerators["accelerators"][number],
): AcceleratorStatus {
  const totalBytes = bigintToNumber(accel.memoryTotalBytes)
  const usedBytes = bigintToNumber(accel.memoryUsedBytes)
  const derivedMemoryUtilization =
    totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0

  return {
    slot: accel.slot,
    kind: accel.kind,
    name: accel.name,
    vendor: accel.vendor ?? undefined,
    busId: accel.busId ?? undefined,
    memoryTotalBytes: totalBytes,
    memoryUsedBytes: usedBytes,
    utilization: accel.utilization ?? undefined,
    memoryUtilization: accel.memoryUtilization ?? derivedMemoryUtilization,
    temperatureC: accel.temperatureC ?? undefined,
    powerWatts: accel.powerWatts ?? undefined,
    processes: accel.processes.map((proc) => ({
      pid: proc.pid ?? undefined,
      name: proc.name,
      user: proc.labUser?.username ?? proc.user ?? undefined,
      memoryBytes: bigintToNumberOrUndefined(proc.memoryBytes),
    })),
    hardwareId: accel.acceleratorDeviceId ?? undefined,
  }
}

function createHost(device: DeviceWithSnapshot, snapshot?: SnapshotWithAccelerators) {
  const memTotal = snapshot?.memTotalBytes ?? device.memTotalBytes
  const diskTotal = snapshot?.diskTotalBytes ?? device.diskTotalBytes
  const swapTotal = snapshot?.swapTotalBytes ?? device.swapTotalBytes

  return {
    Platform: device.platform ?? "",
    PlatformVersion: device.platformVersion ?? "",
    CPU: device.cpuInfo ?? [],
    MemTotal: bigintToNumber(memTotal),
    DiskTotal: bigintToNumber(diskTotal),
    SwapTotal: bigintToNumber(swapTotal),
    Arch: device.arch ?? "",
    Virtualization: device.virtualization ?? "",
    BootTime: device.bootTime ? Math.floor(device.bootTime.getTime() / 1000) : 0,
    CountryCode: device.countryCode ?? "",
    Version: device.version ?? "",
    GPU: device.acceleratorInfo ?? [],
  }
}

function createStatus(snapshot?: SnapshotWithAccelerators): NezhaAPI["status"] {
  const accelerators = snapshot?.accelerators ?? []
  const totalGpuMemory = accelerators.reduce(
    (acc, accel) => acc + bigintToNumber(accel.memoryTotalBytes),
    0,
  )
  const usedGpuMemory = accelerators.reduce(
    (acc, accel) => acc + bigintToNumber(accel.memoryUsedBytes),
    0,
  )
  const utilSamples = accelerators
    .map((accel) => accel.utilization)
    .filter((util): util is number => typeof util === "number")

  const averageUtil =
    utilSamples.length > 0
      ? utilSamples.reduce((sum, val) => sum + val, 0) / utilSamples.length
      : snapshot?.gpuUtilization ?? 0

  return {
    CPU: snapshot?.cpuUsage ?? 0,
    MemUsed: bigintToNumber(snapshot?.memUsedBytes),
    SwapUsed: bigintToNumber(snapshot?.swapUsedBytes),
    DiskUsed: bigintToNumber(snapshot?.diskUsedBytes),
    NetInTransfer: bigintToNumber(snapshot?.netInTransferBytes),
    NetOutTransfer: bigintToNumber(snapshot?.netOutTransferBytes),
    NetInSpeed: snapshot?.netInSpeedBytes ?? 0,
    NetOutSpeed: snapshot?.netOutSpeedBytes ?? 0,
    Uptime: snapshot?.uptimeSeconds ?? 0,
    Load1: snapshot?.load1 ?? 0,
    Load5: snapshot?.load5 ?? 0,
    Load15: snapshot?.load15 ?? 0,
    TcpConnCount: snapshot?.tcpConnections ?? 0,
    UdpConnCount: snapshot?.udpConnections ?? 0,
    ProcessCount: snapshot?.processCount ?? 0,
    Temperatures: snapshot?.temperatureC ?? 0,
    GPU: averageUtil ?? 0,
    Accelerators: accelerators.map(mapAccelerator),
    GpuMemoryTotalBytes: snapshot?.gpuMemoryTotalBytes
      ? bigintToNumber(snapshot.gpuMemoryTotalBytes)
      : totalGpuMemory,
    GpuMemoryUsedBytes: snapshot?.gpuMemoryUsedBytes
      ? bigintToNumber(snapshot.gpuMemoryUsedBytes)
      : usedGpuMemory,
  }
}

function toSafeServer(server: NezhaAPI): NezhaAPISafe {
  const { ipv4: _ipv4, ipv6: _ipv6, valid_ip: _validIp, ...rest } = server
  return rest
}

function mapDevice(device: DeviceWithSnapshot): NezhaAPI {
  const snapshot = device.snapshots[0]
  const online = snapshot ? snapshot.online && isSnapshotFresh(snapshot) : false

  return {
    id: device.id,
    name: device.name,
    tag: device.tag ?? "",
    last_active: snapshot ? Math.floor(snapshot.recordedAt.getTime() / 1000) : 0,
    online_status: online,
    ipv4: device.ipAddress ?? "",
    ipv6: "",
    valid_ip: device.ipAddress ?? "",
    display_index: device.displayIndex ?? 0,
    hide_for_guest: false,
    host: createHost(device, snapshot),
    status: createStatus(snapshot),
  }
}

export async function getLabServerData(): Promise<ServerApi> {
  const devices = await prisma.device.findMany({
    include: {
      snapshots: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        include: {
          accelerators: {
            include: {
              processes: {
                include: { labUser: true },
              },
              acceleratorDevice: true,
            },
            orderBy: { slot: "asc" },
          },
        },
      },
    },
    orderBy: [{ displayIndex: "desc" }, { name: "asc" }],
  })

  const servers = devices.map(mapDevice)
  const safeServers = servers.map(toSafeServer)
  const liveServers = servers.filter((server) => server.online_status).length

  const aggregates = servers.reduce(
    (acc, server) => {
      const status = server.status
      if (typeof status.GpuMemoryTotalBytes === "number") {
        acc.totalGpuMemory += status.GpuMemoryTotalBytes
      }
      if (typeof status.GpuMemoryUsedBytes === "number") {
        acc.totalGpuMemoryUsed += status.GpuMemoryUsedBytes
      }
      if (typeof status.GPU === "number") {
        acc.gpuUtilSamples += 1
        acc.totalGpuUtil += status.GPU
      }
      return acc
    },
    {
      totalGpuMemory: 0,
      totalGpuMemoryUsed: 0,
      totalGpuUtil: 0,
      gpuUtilSamples: 0,
    },
  )

  return {
    live_servers: liveServers,
    offline_servers: safeServers.length - liveServers,
    total_out_bandwidth: 0,
    total_in_bandwidth: 0,
    total_out_speed: 0,
    total_in_speed: 0,
    total_gpu_memory: aggregates.totalGpuMemory,
    total_gpu_memory_used: aggregates.totalGpuMemoryUsed,
    average_gpu_utilization:
      aggregates.gpuUtilSamples > 0 ? aggregates.totalGpuUtil / aggregates.gpuUtilSamples : 0,
    result: safeServers,
  }
}

export async function getLabServerDetail(serverId: number): Promise<NezhaAPI> {
  const device = await prisma.device.findUnique({
    where: { id: serverId },
    include: {
      snapshots: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        include: {
          accelerators: {
            include: {
              processes: {
                include: { labUser: true },
              },
              acceleratorDevice: true,
            },
            orderBy: { slot: "asc" },
          },
        },
      },
    },
  })

  if (!device) {
    throw new Error(`Device ${serverId} not found`)
  }

  return mapDevice(device as DeviceWithSnapshot)
}

export async function getLabServerMonitor(serverId: number, limit = 288): Promise<LabMonitorPoint[]> {
  const snapshots = await prisma.deviceSnapshot.findMany({
    where: { deviceId: serverId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    select: {
      recordedAt: true,
      gpuUtilization: true,
      gpuMemoryTotalBytes: true,
      gpuMemoryUsedBytes: true,
      powerWatts: true,
    },
  })

  return snapshots
    .map((snapshot) => ({
      recordedAt: snapshot.recordedAt.toISOString(),
      gpuUtilization: snapshot.gpuUtilization ?? 0,
      gpuMemoryUsedBytes: bigintToNumber(snapshot.gpuMemoryUsedBytes),
      gpuMemoryTotalBytes: bigintToNumber(snapshot.gpuMemoryTotalBytes),
      powerWatts: snapshot.powerWatts ?? undefined,
    }))
    .reverse()
}

export async function getLabServerIP(serverId: number): Promise<string> {
  const device = await prisma.device.findUnique({
    where: { id: serverId },
    select: { ipAddress: true },
  })

  return device?.ipAddress ?? ""
}

export async function getLabDriverInfo() {
  const totalDevices = await prisma.device.count()
  return {
    name: "lab-prisma",
    capabilities: LAB_CAPABILITIES,
    availableDrivers: ["lab-prisma"],
    totalDevices,
  }
}

export async function checkLabHealth(): Promise<boolean> {
  try {
    await prisma.device.count()
    return true
  } catch (error) {
    console.error("Lab data health check failed:", error)
    return false
  }
}
