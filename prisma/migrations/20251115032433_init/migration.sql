-- CreateEnum
CREATE TYPE "AcceleratorKind" AS ENUM ('GPU', 'NPU');

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "location" TEXT,
    "rack" TEXT,
    "ipAddress" TEXT,
    "displayIndex" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT,
    "platformVersion" TEXT,
    "arch" TEXT,
    "cpuInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceleratorInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "virtualization" TEXT,
    "version" TEXT,
    "bootTime" TIMESTAMP(3),
    "countryCode" TEXT,
    "memTotalBytes" BIGINT,
    "diskTotalBytes" BIGINT,
    "swapTotalBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSnapshot" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uptimeSeconds" INTEGER,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "cpuUsage" DOUBLE PRECISION,
    "memUsedBytes" BIGINT,
    "diskUsedBytes" BIGINT,
    "swapUsedBytes" BIGINT,
    "memTotalBytes" BIGINT,
    "diskTotalBytes" BIGINT,
    "swapTotalBytes" BIGINT,
    "netInTransferBytes" BIGINT,
    "netOutTransferBytes" BIGINT,
    "netInSpeedBytes" DOUBLE PRECISION,
    "netOutSpeedBytes" DOUBLE PRECISION,
    "load1" DOUBLE PRECISION,
    "load5" DOUBLE PRECISION,
    "load15" DOUBLE PRECISION,
    "tcpConnections" INTEGER,
    "udpConnections" INTEGER,
    "processCount" INTEGER,
    "gpuUtilization" DOUBLE PRECISION,
    "gpuMemoryUsedBytes" BIGINT,
    "gpuMemoryTotalBytes" BIGINT,
    "temperatureC" DOUBLE PRECISION,
    "powerWatts" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceleratorDevice" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "busId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcceleratorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceleratorSnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "kind" "AcceleratorKind" NOT NULL DEFAULT 'GPU',
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "busId" TEXT,
    "memoryTotalBytes" BIGINT NOT NULL,
    "memoryUsedBytes" BIGINT NOT NULL,
    "utilization" DOUBLE PRECISION,
    "memoryUtilization" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "powerWatts" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceleratorDeviceId" INTEGER,

    CONSTRAINT "AcceleratorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceleratorProcess" (
    "id" SERIAL NOT NULL,
    "acceleratorId" INTEGER NOT NULL,
    "pid" INTEGER,
    "name" TEXT NOT NULL,
    "user" TEXT,
    "labUserId" INTEGER,
    "memoryBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceleratorProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_slug_key" ON "Device"("slug");

-- CreateIndex
CREATE INDEX "DeviceSnapshot_deviceId_recordedAt_idx" ON "DeviceSnapshot"("deviceId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcceleratorDevice_deviceId_slot_key" ON "AcceleratorDevice"("deviceId", "slot");

-- CreateIndex
CREATE INDEX "AcceleratorSnapshot_snapshotId_idx" ON "AcceleratorSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "AcceleratorProcess_acceleratorId_idx" ON "AcceleratorProcess"("acceleratorId");

-- CreateIndex
CREATE UNIQUE INDEX "LabUser_username_key" ON "LabUser"("username");

-- AddForeignKey
ALTER TABLE "DeviceSnapshot" ADD CONSTRAINT "DeviceSnapshot_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorDevice" ADD CONSTRAINT "AcceleratorDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorSnapshot" ADD CONSTRAINT "AcceleratorSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DeviceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorSnapshot" ADD CONSTRAINT "AcceleratorSnapshot_acceleratorDeviceId_fkey" FOREIGN KEY ("acceleratorDeviceId") REFERENCES "AcceleratorDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorProcess" ADD CONSTRAINT "AcceleratorProcess_acceleratorId_fkey" FOREIGN KEY ("acceleratorId") REFERENCES "AcceleratorSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorProcess" ADD CONSTRAINT "AcceleratorProcess_labUserId_fkey" FOREIGN KEY ("labUserId") REFERENCES "LabUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
