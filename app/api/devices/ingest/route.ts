import type { Prisma } from "@prisma/client"
import { NextResponse, type NextRequest } from "next/server"
import getEnv from "@/lib/env-entry"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type CapacityPayload = {
  totalBytes?: number
  usedBytes?: number
}

type NetworkPayload = {
  inTransferBytes?: number
  outTransferBytes?: number
  inSpeedBytes?: number
  outSpeedBytes?: number
}

type LoadPayload = {
  load1?: number
  load5?: number
  load15?: number
}

type ConnectionsPayload = {
  tcp?: number
  udp?: number
}

type GpuPayload = {
  utilization?: number
  memoryTotalBytes?: number
  memoryUsedBytes?: number
}

type AcceleratorProcessPayload = {
  pid?: number
  name: string
  user?: string
  memoryBytes?: number
}

type AcceleratorPayload = {
  slot?: number
  kind?: "GPU" | "NPU"
  name: string
  vendor?: string
  busId?: string
  memoryTotalBytes: number
  memoryUsedBytes: number
  utilization?: number
  memoryUtilization?: number
  temperatureC?: number
  powerWatts?: number
  processes?: AcceleratorProcessPayload[]
}

type PreparedProcess = {
  pid?: number
  name: string
  username?: string
  memoryBytes?: bigint
}

type PreparedAccelerator = {
  slot: number
  kind: "GPU" | "NPU"
  name: string
  vendor?: string
  busId?: string
  memoryTotalBytes: bigint
  memoryUsedBytes: bigint
  utilization?: number
  memoryUtilization?: number
  temperatureC?: number
  powerWatts?: number
  processes: PreparedProcess[]
}

type DevicePayload = {
  slug: string
  name: string
  tag?: string
  location?: string
  rack?: string
  ipAddress?: string
  displayIndex?: number
  platform?: string
  platformVersion?: string
  arch?: string
  cpuInfo?: string[]
  acceleratorInfo?: string[]
  virtualization?: string
  version?: string
  bootTime?: string
  countryCode?: string
}

type SnapshotPayload = {
  recordedAt?: string
  uptimeSeconds?: number
  online?: boolean
  cpuUsage?: number
  memory?: CapacityPayload
  disk?: CapacityPayload
  swap?: CapacityPayload
  network?: NetworkPayload
  load?: LoadPayload
  connections?: ConnectionsPayload
  processCount?: number
  gpu?: GpuPayload
  temperatureC?: number
  powerWatts?: number
}

type DeviceIngestRequest = {
  device: DevicePayload
  snapshot?: SnapshotPayload
  accelerators?: AcceleratorPayload[]
}

const TOKEN_HEADER = "x-lab-token"

function toBigIntValue(value?: number | string | null): bigint | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return BigInt(trimmed)
  }
  if (Number.isNaN(value)) return undefined
  return BigInt(Math.round(value))
}

function assertBigInt(value: number | string | undefined, label: string): bigint {
  const parsed = toBigIntValue(value)
  if (parsed === undefined) {
    throw new Error(`${label} is required`)
  }
  return parsed
}

function normalizeStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim())))
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }
  return date
}

export async function POST(req: NextRequest) {
  const ingestToken = getEnv("LabIngestToken")
  if (!ingestToken) {
    return NextResponse.json({ error: "LabIngestToken is not configured" }, { status: 503 })
  }

  const token = req.headers.get(TOKEN_HEADER)
  if (!token || token !== ingestToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: DeviceIngestRequest
  try {
    payload = (await req.json()) as DeviceIngestRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  if (!payload.device?.slug || !payload.device?.name) {
    return NextResponse.json({ error: "device.slug and device.name are required" }, { status: 400 })
  }

  const snapshot: SnapshotPayload = payload.snapshot ?? {}
  let recordedAt: Date
  try {
    recordedAt = snapshot.recordedAt ? parseDate(snapshot.recordedAt)! : new Date()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid snapshot timestamp" },
      { status: 400 },
    )
  }

  const accelerators = payload.accelerators ?? []
  const labUserNames = new Set<string>()

  let acceleratorCreates: PreparedAccelerator[]
  try {
    acceleratorCreates = accelerators.map((accelerator, index) => {
      if (!accelerator.name) {
        throw new Error(`accelerators[${index}].name is required`)
      }
      const memoryTotalBytes = assertBigInt(
        accelerator.memoryTotalBytes,
        `accelerators[${index}].memoryTotalBytes`,
      )
      const memoryUsedBytes = assertBigInt(
        accelerator.memoryUsedBytes,
        `accelerators[${index}].memoryUsedBytes`,
      )

      const processes =
        accelerator.processes?.reduce<PreparedProcess[]>((acc, process) => {
          if (!process.name) {
            return acc
          }
          const username = process.user?.trim()
          if (username) {
            labUserNames.add(username)
          }
          acc.push({
            pid: process.pid,
            name: process.name,
            username,
            memoryBytes: toBigIntValue(process.memoryBytes),
          })
          return acc
        }, []) ?? []

      return {
        slot: accelerator.slot ?? index,
        kind: accelerator.kind ?? "GPU",
        name: accelerator.name,
        vendor: accelerator.vendor,
        busId: accelerator.busId,
        memoryTotalBytes,
        memoryUsedBytes,
        utilization: accelerator.utilization,
        memoryUtilization: accelerator.memoryUtilization,
        temperatureC: accelerator.temperatureC,
        powerWatts: accelerator.powerWatts,
        processes,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid accelerator payload" },
      { status: 400 },
    )
  }

  const acceleratorNames = acceleratorCreates
    .map((acc) => acc.name)
    .filter((name) => typeof name === "string" && name.trim())
  const gpuUtilSamples = acceleratorCreates
    .map((acc) => acc.utilization)
    .filter((value): value is number => typeof value === "number")

  const gpuTotals = acceleratorCreates.reduce(
    (acc, accelerator) => {
      acc.total += accelerator.memoryTotalBytes
      acc.used += accelerator.memoryUsedBytes
      return acc
    },
    { total: BigInt(0), used: BigInt(0) },
  )

  const gpuUtilization =
    typeof snapshot.gpu?.utilization === "number"
      ? snapshot.gpu.utilization
      : gpuUtilSamples.length > 0
        ? gpuUtilSamples.reduce((sum, value) => sum + value, 0) / gpuUtilSamples.length
        : undefined

  const deviceCpuInfo = normalizeStringArray(payload.device.cpuInfo)
  const declaredAccelerators = normalizeStringArray(payload.device.acceleratorInfo)
  let bootTime: Date | undefined
  try {
    bootTime = parseDate(payload.device.bootTime)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid device.bootTime" },
      { status: 400 },
    )
  }

  const memoryTotal = snapshot.memory?.totalBytes ?? undefined
  const diskTotal = snapshot.disk?.totalBytes ?? undefined
  const swapTotal = snapshot.swap?.totalBytes ?? undefined

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const device = await tx.device.upsert({
        where: { slug: payload.device.slug },
        update: {
          name: payload.device.name,
          tag: payload.device.tag,
          location: payload.device.location,
          rack: payload.device.rack,
          ipAddress: payload.device.ipAddress,
          displayIndex: payload.device.displayIndex ?? 0,
          platform: payload.device.platform,
          platformVersion: payload.device.platformVersion,
          arch: payload.device.arch,
          cpuInfo: deviceCpuInfo,
          acceleratorInfo: Array.from(new Set([...declaredAccelerators, ...acceleratorNames])),
          virtualization: payload.device.virtualization,
          version: payload.device.version,
          bootTime,
          countryCode: payload.device.countryCode,
          memTotalBytes: toBigIntValue(memoryTotal),
          diskTotalBytes: toBigIntValue(diskTotal),
          swapTotalBytes: toBigIntValue(swapTotal),
        },
        create: {
          slug: payload.device.slug,
          name: payload.device.name,
          tag: payload.device.tag,
          location: payload.device.location,
          rack: payload.device.rack,
          ipAddress: payload.device.ipAddress,
          displayIndex: payload.device.displayIndex ?? 0,
          platform: payload.device.platform,
          platformVersion: payload.device.platformVersion,
          arch: payload.device.arch,
          cpuInfo: deviceCpuInfo,
          acceleratorInfo: Array.from(new Set([...declaredAccelerators, ...acceleratorNames])),
          virtualization: payload.device.virtualization,
          version: payload.device.version,
          bootTime,
          countryCode: payload.device.countryCode,
          memTotalBytes: toBigIntValue(memoryTotal),
          diskTotalBytes: toBigIntValue(diskTotal),
          swapTotalBytes: toBigIntValue(swapTotal),
        },
      })

      const snapshotRecord = await tx.deviceSnapshot.create({
        data: {
          deviceId: device.id,
          recordedAt,
          uptimeSeconds: snapshot.uptimeSeconds,
          online: snapshot.online ?? true,
          cpuUsage: snapshot.cpuUsage,
          memUsedBytes: toBigIntValue(snapshot.memory?.usedBytes),
          diskUsedBytes: toBigIntValue(snapshot.disk?.usedBytes),
          swapUsedBytes: toBigIntValue(snapshot.swap?.usedBytes),
          memTotalBytes: toBigIntValue(memoryTotal) ?? device.memTotalBytes,
          diskTotalBytes: toBigIntValue(diskTotal) ?? device.diskTotalBytes,
          swapTotalBytes: toBigIntValue(swapTotal) ?? device.swapTotalBytes,
          netInTransferBytes: toBigIntValue(snapshot.network?.inTransferBytes),
          netOutTransferBytes: toBigIntValue(snapshot.network?.outTransferBytes),
          netInSpeedBytes: snapshot.network?.inSpeedBytes,
          netOutSpeedBytes: snapshot.network?.outSpeedBytes,
          load1: snapshot.load?.load1,
          load5: snapshot.load?.load5,
          load15: snapshot.load?.load15,
          tcpConnections: snapshot.connections?.tcp,
          udpConnections: snapshot.connections?.udp,
          processCount: snapshot.processCount,
          gpuUtilization,
          gpuMemoryTotalBytes:
            toBigIntValue(snapshot.gpu?.memoryTotalBytes) ?? (gpuTotals.total || undefined),
          gpuMemoryUsedBytes:
            toBigIntValue(snapshot.gpu?.memoryUsedBytes) ?? (gpuTotals.used || undefined),
          temperatureC: snapshot.temperatureC,
          powerWatts: snapshot.powerWatts,
        },
      })

      const userIdMap = new Map<string, number>()
      if (labUserNames.size > 0) {
        await Promise.all(
          Array.from(labUserNames).map(async (username) => {
            const record = await tx.labUser.upsert({
              where: { username },
              update: {},
              create: { username },
            })
            userIdMap.set(username, record.id)
          }),
        )
      }

      for (const accelerator of acceleratorCreates) {
        const acceleratorDevice = await tx.acceleratorDevice.upsert({
          where: {
            deviceId_slot: {
              deviceId: device.id,
              slot: accelerator.slot,
            },
          },
          update: {
            name: accelerator.name,
            vendor: accelerator.vendor,
            busId: accelerator.busId,
          },
          create: {
            deviceId: device.id,
            slot: accelerator.slot,
            name: accelerator.name,
            vendor: accelerator.vendor,
            busId: accelerator.busId,
          },
        })

        await tx.acceleratorSnapshot.create({
          data: {
            snapshotId: snapshotRecord.id,
            slot: accelerator.slot,
            kind: accelerator.kind,
            name: accelerator.name,
            vendor: accelerator.vendor,
            busId: accelerator.busId,
            memoryTotalBytes: accelerator.memoryTotalBytes,
            memoryUsedBytes: accelerator.memoryUsedBytes,
            utilization: accelerator.utilization,
            memoryUtilization: accelerator.memoryUtilization,
            temperatureC: accelerator.temperatureC,
            powerWatts: accelerator.powerWatts,
            acceleratorDeviceId: acceleratorDevice.id,
            processes: accelerator.processes.length
              ? {
                  create: accelerator.processes.map((process) => ({
                    pid: process.pid,
                    name: process.name,
                    user: process.username,
                    labUserId: process.username ? userIdMap.get(process.username) : undefined,
                    memoryBytes: process.memoryBytes,
                  })),
                }
              : undefined,
          },
        })
      }
    })
  } catch (error) {
    console.error("Failed to ingest device snapshot:", error)
    return NextResponse.json({ error: "Failed to record snapshot" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
