import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createRequire } from 'node:module';
import { Contract, JsonRpcProvider } from 'ethers';
import { readStore, updateStore } from './store.mjs';
import { sendReportAlertMail } from './mailer.mjs';

const require = createRequire(import.meta.url);
const CONTRACT_ABI = require('../src/abi/MediProof.json');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const API_BASE = process.env.API_BASE || '/api';
const RPC_URL = process.env.VITE_RPC_URL || process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = Number(process.env.VITE_CHAIN_ID || 10143);
const CONTRACT_ADDRESS = (process.env.VITE_CONTRACT_ADDRESS || '').trim();

let readProvider;
let readContract;

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '1mb' }));

function isValidWallet(wallet) {
  return /^0x[a-fA-F0-9]{40}$/.test(wallet || '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function normalizeWallet(wallet) {
  return (wallet || '').toLowerCase();
}

function normalizeText(value, max = 400) {
  return String(value || '').trim().slice(0, max);
}

function isValidCid(value) {
  const v = String(value || '').trim();
  return /^[a-zA-Z0-9]+$/.test(v) && v.length >= 20 && v.length <= 120;
}

function getReadContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('VITE_CONTRACT_ADDRESS is missing on server');
  }

  if (!readProvider) {
    readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  }
  if (!readContract) {
    readContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
  }
  return readContract;
}

async function isRegisteredBatch(batchId, expectedManufacturerWallet) {
  try {
    const contract = getReadContract();
    const batch = await contract.getBatch(batchId);
    const owner = normalizeWallet(batch?.manufacturer);
    return Boolean(owner && owner === normalizeWallet(expectedManufacturerWallet));
  } catch {
    return false;
  }
}

app.get(`${API_BASE}/health`, async (_req, res) => {
  const data = await readStore();
  res.json({
    ok: true,
    manufacturers: Object.keys(data.manufacturers || {}).length,
    sentReports: Object.keys(data.sentReports || {}).length,
    forumPosts: Array.isArray(data.forumPosts) ? data.forumPosts.length : 0,
  });
});

app.get(`${API_BASE}/forum/posts`, async (req, res) => {
  const rawLimit = Number(req.query?.limit || 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

  const store = await readStore();
  const posts = Array.isArray(store.forumPosts) ? store.forumPosts : [];

  return res.json({
    posts: posts
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, limit),
  });
});

app.post(`${API_BASE}/forum/posts`, async (req, res) => {
  const wallet = normalizeWallet(req.body?.wallet);
  const rawContent = String(req.body?.content || '').trim();
  const content = rawContent;
  const rawImages = Array.isArray(req.body?.imageHashes) ? req.body.imageHashes : [];
  const imageHashes = rawImages.map((x) => String(x || '').trim()).filter(Boolean);

  if (!isValidWallet(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }
  if (rawContent.length > 200) {
    return res.status(400).json({ error: 'content cannot exceed 200 characters' });
  }
  if (imageHashes.length > 2) {
    return res.status(400).json({ error: 'Only up to 2 images are allowed' });
  }
  if (imageHashes.some((cid) => !isValidCid(cid))) {
    return res.status(400).json({ error: 'Invalid image hash format' });
  }

  const post = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    wallet,
    content,
    imageHashes,
    createdAt: Date.now(),
  };

  await updateStore((store) => {
    const merged = { ...store };
    const existing = Array.isArray(store.forumPosts) ? store.forumPosts : [];
    merged.forumPosts = [post, ...existing].slice(0, 2000);
    return merged;
  });

  return res.status(201).json({ ok: true, post });
});

app.put(`${API_BASE}/manufacturers/:wallet`, async (req, res) => {
  const wallet = normalizeWallet(req.params.wallet);
  if (!isValidWallet(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const email = normalizeText(req.body?.email, 160);
  const name = normalizeText(req.body?.name, 120);
  const licenseNumber = normalizeText(req.body?.licenseNumber, 120);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const next = await updateStore((store) => {
    const merged = { ...store };
    merged.manufacturers = { ...store.manufacturers };
    merged.manufacturers[wallet] = {
      wallet,
      email,
      name,
      licenseNumber,
      updatedAt: Date.now(),
    };
    return merged;
  });

  return res.status(200).json(next.manufacturers[wallet]);
});

app.get(`${API_BASE}/manufacturers/:wallet`, async (req, res) => {
  const wallet = normalizeWallet(req.params.wallet);
  if (!isValidWallet(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const store = await readStore();
  const record = store.manufacturers?.[wallet];

  if (!record) {
    return res.status(404).json({ error: 'Manufacturer contact not found' });
  }

  return res.json(record);
});

app.post(`${API_BASE}/reports/notify`, async (req, res) => {
  const batchId = normalizeText(req.body?.batchId, 180);
  const reason = normalizeText(req.body?.reason, 1000);
  const reporter = normalizeWallet(req.body?.reporter);
  const reporterEmail = normalizeText(req.body?.reporterEmail, 160);
  const manufacturerWallet = normalizeWallet(req.body?.manufacturerWallet);
  const manufacturerName = normalizeText(req.body?.manufacturerName || 'Manufacturer', 120);
  const txHash = normalizeText(req.body?.txHash, 80);

  if (!batchId) return res.status(400).json({ error: 'batchId is required' });
  if (!reason || reason.length < 10) return res.status(400).json({ error: 'reason must be at least 10 characters' });
  if (!isValidWallet(reporter)) return res.status(400).json({ error: 'Invalid reporter wallet' });
  if (!isValidEmail(reporterEmail)) return res.status(400).json({ error: 'Invalid reporter email' });
  if (!isValidWallet(manufacturerWallet)) return res.status(400).json({ error: 'Invalid manufacturer wallet' });
  if (!txHash) return res.status(400).json({ error: 'txHash is required' });

  const registered = await isRegisteredBatch(batchId, manufacturerWallet);
  if (!registered) {
    return res.status(400).json({ error: 'Batch is not registered on-chain for this manufacturer' });
  }

  const current = await readStore();
  if (current.sentReports?.[txHash]) {
    return res.status(200).json({
      ok: true,
      deduped: true,
      message: 'Report already notified earlier for this transaction.',
    });
  }

  const manufacturer = current.manufacturers?.[manufacturerWallet];
  if (!manufacturer?.email) {
    return res.status(404).json({ error: 'Manufacturer email not found for this wallet' });
  }

  try {
    await sendReportAlertMail({
      toEmail: manufacturer.email,
      batchId,
      reason,
      reporter,
      reporterEmail,
      manufacturerName,
      manufacturerWallet,
      txHash,
    });

    await updateStore((store) => {
      const merged = { ...store };
      merged.sentReports = { ...store.sentReports };
      merged.sentReports[txHash] = {
        txHash,
        batchId,
        reporter,
        reporterEmail,
        manufacturerWallet,
        email: manufacturer.email,
        sentAt: Date.now(),
      };
      return merged;
    });

    return res.status(200).json({
      ok: true,
      deduped: false,
      message: `Report recorded and email sent to ${manufacturer.email}.`,
    });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Email dispatch failed' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[mediproof-server] listening on http://localhost:${PORT}${API_BASE}`);
});
