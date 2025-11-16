#!/usr/bin/env python3
"""
Periodic NVIDIA GPU sampler that posts accelerator stats to the Nezha Dash lab ingestion API.

Dependencies:
  pip install psutil requests
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import subprocess
import time
from datetime import datetime, timezone
from typing import Any

import psutil
import requests


def run_command(cmd: list[str]) -> str:
  """Run a command and return stdout, raising on failure."""
  result = subprocess.run(cmd, capture_output=True, text=True, check=True)
  return result.stdout.strip()


def mb_to_bytes(value: str | float | int) -> int:
  return int(float(value) * 1024 * 1024)


def gather_gpu_samples() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
  """Collect GPU stats and per-process usage via nvidia-smi."""
  gpu_query = (
    "index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,"
    "power.draw,power.limit,uuid"
  )
  raw_gpu = run_command(
    ["nvidia-smi", f"--query-gpu={gpu_query}", "--format=csv,noheader,nounits"],
  )

  process_query = "gpu_uuid,pid,process_name,used_memory"
  raw_proc = run_command(
    ["nvidia-smi", f"--query-compute-apps={process_query}", "--format=csv,noheader,nounits"],
  )

  gpu_rows: list[dict[str, Any]] = []
  uuid_to_slot: dict[str, int] = {}

  if raw_gpu:
    for line in raw_gpu.splitlines():
      parts = [part.strip() for part in line.split(",")]
      if len(parts) != 9:
        continue
      idx, name, mem_total, mem_used, util, temp, power_draw, power_limit, uuid = parts
      uuid_to_slot[uuid] = int(idx)
      total_bytes = mb_to_bytes(mem_total)
      used_bytes = mb_to_bytes(mem_used)
      gpu_rows.append(
        {
          "slot": int(idx),
          "uuid": uuid,
          "name": name,
          "memory_total_bytes": total_bytes,
          "memory_used_bytes": used_bytes,
          "utilization": float(util) if util else None,
          "memory_utilization": (used_bytes / total_bytes) * 100 if total_bytes else None,
          "temperatureC": float(temp) if temp else None,
          "powerWatts": float(power_draw) if power_draw else None,
          "powerLimit": float(power_limit) if power_limit else None,
        },
      )

  process_rows: dict[str, list[dict[str, Any]]] = {}
  if raw_proc:
    for line in raw_proc.splitlines():
      parts = [part.strip() for part in line.split(",")]
      if len(parts) != 4:
        continue
      gpu_uuid, pid_str, process_name, used_mem = parts
      try:
        pid = int(pid_str)
        username = psutil.Process(pid).username()
      except (ValueError, psutil.Error):
        username = None
      process_rows.setdefault(gpu_uuid, []).append(
        {
          "pid": int(pid_str),
          "name": process_name,
          "user": username,
          "memory_bytes": mb_to_bytes(used_mem),
        },
      )

  return gpu_rows, process_rows


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
  """Assemble the device + snapshot payload for ingestion."""
  hostname = socket.gethostname()
  device_slug = args.slug or hostname
  device_name = args.name or hostname
  gpu_rows, process_rows = gather_gpu_samples()

  mem = psutil.virtual_memory()
  disk = psutil.disk_usage(args.disk_path)
  uptime_seconds = int(time.time() - psutil.boot_time())
  recorded_at = datetime.now(timezone.utc).isoformat()

  accelerators = []
  for gpu in gpu_rows:
    processes = [
      {
        "pid": proc["pid"],
        "name": proc["name"],
        "user": proc["user"],
        "memoryBytes": proc["memory_bytes"],
      }
      for proc in process_rows.get(gpu["uuid"], [])
    ]
    accelerators.append(
      {
        "slot": gpu["slot"],
        "kind": "GPU",
        "name": gpu["name"],
        "vendor": "NVIDIA",
        "busId": gpu["uuid"],
        "memoryTotalBytes": gpu["memory_total_bytes"],
        "memoryUsedBytes": gpu["memory_used_bytes"],
        "utilization": gpu["utilization"],
        "memoryUtilization": gpu["memory_utilization"],
        "temperatureC": gpu["temperatureC"],
        "powerWatts": gpu["powerWatts"],
        "processes": processes,
      },
    )

  snapshot = {
    "recordedAt": recorded_at,
    "uptimeSeconds": uptime_seconds,
    "online": True,
    "cpuUsage": psutil.cpu_percent(interval=None),
    "memory": {"totalBytes": mem.total, "usedBytes": mem.used},
    "disk": {"totalBytes": disk.total, "usedBytes": disk.used},
    "processCount": len(psutil.pids()),
    "gpu": {
      "utilization": (
        sum(row["utilization"] or 0 for row in gpu_rows) / len(gpu_rows)
        if gpu_rows
        else None
      ),
      "memoryTotalBytes": sum(row["memory_total_bytes"] for row in gpu_rows),
      "memoryUsedBytes": sum(row["memory_used_bytes"] for row in gpu_rows),
    },
  }

  return {
    "device": {
      "slug": device_slug,
      "name": device_name,
      "location": args.location,
      "platform": platform.platform(),
      "platformVersion": platform.version(),
      "arch": platform.machine(),
      "cpuInfo": [platform.processor() or "unknown"],
      "acceleratorInfo": [row["name"] for row in gpu_rows],
    },
    "snapshot": snapshot,
    "accelerators": accelerators,
  }


def post_snapshot(args: argparse.Namespace) -> None:
  payload = build_payload(args)
  headers = {"x-lab-token": args.token, "content-type": "application/json"}
  response = requests.post(args.endpoint, headers=headers, json=payload, timeout=30)
  response.raise_for_status()
  print(f"[{datetime.now().isoformat()}] Posted snapshot ({len(payload['accelerators'])} GPUs)")


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="NVIDIA GPU lab ingestion client")
  parser.add_argument("--endpoint", default=os.getenv("LAB_ENDPOINT"), required=False)
  parser.add_argument("--token", default=os.getenv("LAB_TOKEN"), required=False)
  parser.add_argument("--slug", default=os.getenv("LAB_DEVICE_SLUG"))
  parser.add_argument("--name", default=os.getenv("LAB_DEVICE_NAME"))
  parser.add_argument("--location", default=os.getenv("LAB_DEVICE_LOCATION"))
  parser.add_argument("--disk-path", default=os.getenv("LAB_DISK_PATH", "/"))
  parser.add_argument(
    "--interval",
    type=int,
    default=int(os.getenv("LAB_INTERVAL", "300")),
    help="Seconds between samples (default 300)",
  )
  parser.add_argument(
    "--once",
    action="store_true",
    help="Collect and post a single snapshot (default loops forever)",
  )
  args = parser.parse_args()
  if not args.endpoint or not args.token:
    parser.error("LAB_ENDPOINT and LAB_TOKEN (or CLI equivalents) are required")
  return args


def main() -> None:
  args = parse_args()
  while True:
    try:
      post_snapshot(args)
    except Exception as error:
      print(f"Failed to post snapshot: {error}")
    if args.once:
      break
    time.sleep(max(5, args.interval))


if __name__ == "__main__":
  main()
