import {
  ManufacturerRegistered,
  BatchRegistered,
  BatchReported,
  BatchRecalled,
  BatchSuspicious,
} from '../generated/MediProof/MediProof';
import {
  Batch,
  Manufacturer,
  Report,
  Recall,
  MediProofStats,
} from '../generated/schema';

const GLOBAL_ID = 'global';

function getOrCreateStats(): MediProofStats {
  let stats = MediProofStats.load(GLOBAL_ID);
  if (!stats) {
    stats = new MediProofStats(GLOBAL_ID);
    stats.totalBatches        = 0;
    stats.totalManufacturers  = 0;
    stats.totalReports        = 0;
    stats.totalRecalls        = 0;
    stats.suspiciousBatches   = 0;
  }
  return stats;
}

export function handleManufacturerRegistered(event: ManufacturerRegistered): void {
  let id = event.params.wallet.toHexString();
  let m  = new Manufacturer(id);
  m.name          = event.params.name;
  m.licenseNumber = event.params.licenseNumber;
  m.registeredAt  = event.params.timestamp;
  m.totalBatches  = 0;
  m.save();

  let stats = getOrCreateStats();
  stats.totalManufacturers += 1;
  stats.save();
}

export function handleBatchRegistered(event: BatchRegistered): void {
  let b = new Batch(event.params.batchId);
  b.manufacturer = event.params.manufacturer.toHexString();
  b.ipfsHash     = event.params.ipfsHash;
  b.expiryDate   = event.params.expiryDate;
  b.isRecalled   = false;
  b.createdAt    = event.params.timestamp;
  b.reportCount  = 0;
  b.isSuspicious = false;
  b.save();

  let m = Manufacturer.load(event.params.manufacturer.toHexString());
  if (m) {
    m.totalBatches += 1;
    m.save();
  }

  let stats = getOrCreateStats();
  stats.totalBatches += 1;
  stats.save();
}

export function handleBatchReported(event: BatchReported): void {
  let id = event.params.batchId + '-' + event.params.reporter.toHexString() + '-' + event.block.timestamp.toString();
  let r  = new Report(id);
  r.batch     = event.params.batchId;
  r.reporter  = event.params.reporter;
  r.reason    = event.params.reason;
  r.timestamp = event.params.timestamp;
  r.save();

  let b = Batch.load(event.params.batchId);
  if (b) {
    b.reportCount += 1;
    b.save();
  }

  let stats = getOrCreateStats();
  stats.totalReports += 1;
  stats.save();
}

export function handleBatchRecalled(event: BatchRecalled): void {
  let b = Batch.load(event.params.batchId);
  if (b) {
    b.isRecalled = true;
    b.save();
  }

  let recallId = event.params.batchId + '-recall';
  let recall   = new Recall(recallId);
  recall.batch        = event.params.batchId;
  recall.manufacturer = event.params.manufacturer;
  recall.timestamp    = event.params.timestamp;
  recall.save();

  let stats = getOrCreateStats();
  stats.totalRecalls += 1;
  stats.save();
}

export function handleBatchSuspicious(event: BatchSuspicious): void {
  let b = Batch.load(event.params.batchId);
  if (b) {
    b.isSuspicious = true;
    b.save();
  }

  let stats = getOrCreateStats();
  stats.suspiciousBatches += 1;
  stats.save();
}
