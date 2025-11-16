/**
 * New server data fetching implementation using the driver architecture
 * This provides a clean, decoupled API for fetching server data from various sources
 */

"use server"

import {
  checkLabHealth,
  getLabDriverInfo,
  getLabServerData,
  getLabServerDetail,
  getLabServerIP,
  getLabServerMonitor,
  type LabMonitorPoint,
} from "@/lib/lab-data"
import type { NezhaAPI, NezhaAPIMonitor, ServerApi } from "./drivers/types"

/**
 * Get all servers with their current status
 * This is the main API endpoint for fetching server data
 */
export async function GetServerData(): Promise<ServerApi> {
  return await getLabServerData()
}

/**
 * Get detailed information for a specific server
 */
export async function GetServerDetail({ server_id }: { server_id: number }): Promise<NezhaAPI> {
  return await getLabServerDetail(server_id)
}

/**
 * Get monitoring data for a specific server
 * Returns empty array if the current driver doesn't support monitoring
 */
export async function GetServerMonitor({
  server_id,
}: {
  server_id: number
}): Promise<NezhaAPIMonitor[] | LabMonitorPoint[]> {
  return await getLabServerMonitor(server_id)
}

/**
 * Get server IP information
 * Returns empty string if the current driver doesn't support IP info
 */
export async function GetServerIP({ server_id }: { server_id: number }): Promise<string> {
  return await getLabServerIP(server_id)
}

/**
 * Get information about the current data source driver
 */
export async function GetDriverInfo() {
  return await getLabDriverInfo()
}

/**
 * Perform a health check on the current driver
 */
export async function PerformHealthCheck(): Promise<boolean> {
  return await checkLabHealth()
}

// Legacy compatibility exports - these maintain the same API as the original functions
export { GetServerData as GetNezhaData }
