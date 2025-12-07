#!/usr/bin/env python3
"""
Periodic Ascend NPU sampler that posts accelerator stats to the Nezha Dash lab ingestion API.

Dependencies:
  pip install psutil requests
  Ascend driver tools providing `ascend-dmi`
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
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


_NUMBER_RE = re.compile(r"[-+]?\d*\.?\d+")


def parse_number(value: Any) -> float | None:
  """Extract the first numeric value from mixed unit strings such as '39 C'."""
  if value is None:
    return None
  if isinstance(value, (int, float)):
    return float(value)
  if isinstance(value, str):
    match = _NUMBER_RE.search(value.replace(",", ""))
    if match:
      try:
        return float(match.group(0))
      except ValueError:
        return None
  return None


def mb_to_bytes(value: Any) -> int:
  number = parse_number(value)
  if number is None:
    return 0
  return int(number * 1024 * 1024)


def gather_npu_samples() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
  """Collect NPU stats via ascend-dmi."""
  raw = run_command(["ascend-dmi", "-i", "-fmt", "json"])
  data = json.loads(raw) if raw else {}
  devices = (
    data.get("hardware_brief", {})
    .get("server", {})
    .get("devices", [])
  ) or []

  npu_rows: list[dict[str, Any]] = []
  process_rows: dict[str, list[dict[str, Any]]] = {}

  for index, device in enumerate(devices):
    slot = device.get("device_id", index)
    try:
      slot_int = int(slot)
    except (TypeError, ValueError):
      slot_int = index

    mem_info = device.get("memory_information", {}) or {}
    total_bytes = mb_to_bytes(mem_info.get("total"))
    used_bytes = mb_to_bytes(mem_info.get("used"))

    ai_info = device.get("ai_core_information", {}) or {}
    power_info = device.get("power_information", {}) or {}
    utilization = parse_number(ai_info.get("ai_core_usage"))
    temp = parse_number(device.get("temperature"))
    power_raw = parse_number(power_info.get("realtime_power"))
    power = round(power_raw, 2) if power_raw is not None else None
    bus_id = (device.get("pcie_information", {}) or {}).get("bus_id")

    npu_rows.append(
      {
        "slot": slot_int,
        "name": device.get("chip_name") or "Ascend NPU",
        "vendor": "Huawei",
        "bus_id": bus_id,
        "memory_total_bytes": total_bytes,
        "memory_used_bytes": used_bytes,
        "utilization": utilization,
        "memory_utilization": (used_bytes / total_bytes) * 100 if total_bytes else None,
        "temperatureC": temp,
        "powerWatts": power,
      },
    )

  return npu_rows, process_rows


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
  """Assemble the device + snapshot payload for ingestion."""
  hostname = socket.gethostname()
  device_slug = args.slug or hostname
  device_name = args.name or hostname
  npu_rows, process_rows = gather_npu_samples()

  mem = psutil.virtual_memory()
  disk = psutil.disk_usage(args.disk_path)
  uptime_seconds = int(time.time() - psutil.boot_time())
  recorded_at = datetime.now(timezone.utc).isoformat()

  accelerators = []
  for npu in npu_rows:
    processes = [
      {
        "pid": proc["pid"],
        "name": proc["name"],
        "user": proc["user"],
        "memoryBytes": proc["memory_bytes"],
      }
      for proc in process_rows.get(npu.get("bus_id"), [])
    ]
    accelerators.append(
      {
        "slot": npu["slot"],
        "kind": "NPU",
        "name": npu["name"],
        "vendor": npu["vendor"],
        "busId": npu.get("bus_id"),
        "memoryTotalBytes": npu["memory_total_bytes"],
        "memoryUsedBytes": npu["memory_used_bytes"],
        "utilization": npu["utilization"],
        "memoryUtilization": npu["memory_utilization"],
        "temperatureC": npu["temperatureC"],
        "powerWatts": npu["powerWatts"],
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
        sum(row["utilization"] or 0 for row in npu_rows) / len(npu_rows)
        if npu_rows
        else None
      ),
      "memoryTotalBytes": sum(row["memory_total_bytes"] for row in npu_rows),
      "memoryUsedBytes": sum(row["memory_used_bytes"] for row in npu_rows),
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
      "acceleratorInfo": [row["name"] for row in npu_rows],
    },
    "snapshot": snapshot,
    "accelerators": accelerators,
  }


def post_snapshot(args: argparse.Namespace) -> None:
  payload = build_payload(args)
  headers = {"x-lab-token": args.token, "content-type": "application/json"}
  response = requests.post(
    args.endpoint + "/api/devices/ingest",
    headers=headers,
    json=payload,
    timeout=30,
  )
  response.raise_for_status()
  print(f"[{datetime.now().isoformat()}] Posted snapshot ({len(payload['accelerators'])} NPUs)")


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Ascend NPU lab ingestion client")
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
