<div align="center"><img width="600" alt="nezhadash" src="https://github.com/user-attachments/assets/0a5768e1-96f2-4f8a-b77f-01488ed3b237"></div>
<h3 align="center">NezhaDash-GPU 是一个基于 Next.js 实验室显卡监控 的仪表盘</h3>
<br>
修改自 [NezhaDash](https://github.com/hamster1963/nezha-dash)
</div>


### GPU 实验室模式

如果需要以本地加速器为核心进行监控，可以启用内置的 Prisma/PostgreSQL 数据源：

1. 设置数据库连接并开启实验室模式：

```bash
export DATABASE_URL=\"postgresql://USER:PASSWORD@HOST:PORT/DB\"
export LabIngestToken=\"自定义上报密钥\"
export NEXT_PUBLIC_FreeGpuMemoryPercent=\"10\" # 可选：用于首页空闲加速卡阈值
```

2. 安装依赖后生成 Prisma Client（首次部署或模型变更时执行）：

```bash
npx prisma migrate deploy
```

3. 通过 `POST /api/devices/ingest` 上报最新的设备状态，必须携带 `x-lab-token: $LabIngestToken` 请求头。示例请求体：

```json
{
  "device": {
    "slug": "lab-gpu-01",
    "name": "A100-NODE-01",
    "location": "實驗室 A",
    "platform": "Ubuntu 22.04",
    "cpuInfo": ["Intel Xeon Gold 6330"],
    "acceleratorInfo": ["NVIDIA A100 80GB"]
  },
  "snapshot": {
    "recordedAt": "2024-05-01T12:00:00Z",
    "uptimeSeconds": 86400,
    "cpuUsage": 42.5,
    "memory": {
      "totalBytes": 549755813888,
      "usedBytes": 322122547200
    },
    "gpu": {
      "utilization": 71.2
    }
  },
  "accelerators": [
    {
      "slot": 0,
      "name": "NVIDIA A100 80GB",
      "memoryTotalBytes": 85899345920,
      "memoryUsedBytes": 42949672960,
      "utilization": 72.5,
      "temperatureC": 64,
      "powerWatts": 245,
      "processes": [
        {
          "pid": 13579,
          "name": "train.py",
          "user": "alice",
          "memoryBytes": 32212254720
        }
      ]
    }
  ]
}
```

每 5 分钟推送一次即可在仪表盘首页与详情页看到加速器（GPU/NPU）的显存使用、平均利用率、功耗及进程列表等历史数据。

仓库内也提供了一个简单的 Linux NVIDIA 采集脚本 `scripts/nvidia_ingest.py`，依赖 `psutil` 与 `requests`：

```bash
pip install psutil requests
LAB_ENDPOINT="https://your-host/api/devices/ingest" \
LAB_TOKEN="与 LabIngestToken 一致" \
LAB_DEVICE_SLUG="$(hostname -s)" \
python3 scripts/nvidia_ingest.py   # 默认每 5 分钟循环一次
```

若希望通过 systemd/cron 定时采集，可添加 `--once` 参数并将脚本放入计划任务中。

如果需要采集华为昇腾（Ascend）数据，可使用 `scripts/ascend_ingest.py`（依赖同上，并要求 `npu-smi` 提供 JSON 输出）：

```bash
pip install psutil requests
LAB_ENDPOINT="https://your-host/api/devices/ingest" \
LAB_TOKEN="your-secret-token" \
python3 scripts/ascend_ingest.py --once
```
