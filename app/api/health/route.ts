import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import getEnv from "@/lib/env-entry"
import { PerformHealthCheck } from "@/lib/serverFetchV2"

export const dynamic = "force-dynamic"

interface ResError extends Error {
  statusCode: number
  message: string
}

export async function GET() {
  if (getEnv("SitePassword")) {
    const session = await auth()
    if (!session) {
      redirect("/")
    }
  }

  try {
    const isHealthy = await PerformHealthCheck()
    const responseData = {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      status: isHealthy ? "ok" : "error",
      source: "lab-prisma",
    }

    return NextResponse.json(responseData, {
      status: isHealthy ? 200 : 503,
    })
  } catch (error) {
    const err = error as ResError
    console.error("Error in health check:", err)

    const responseData = {
      healthy: false,
      error: err.message || "Health check failed",
      timestamp: new Date().toISOString(),
      status: "error",
      source: "lab-prisma",
    }

    return NextResponse.json(responseData, {
      status: err.statusCode || 500,
    })
  }
}
