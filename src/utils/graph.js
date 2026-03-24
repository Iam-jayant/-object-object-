/**
 * The Graph query utility for MediProof
 *
 * Configure VITE_GRAPH_URL in .env with your deployed subgraph endpoint.
 * Falls back gracefully when The Graph is not available.
 *
 * Example endpoint format:
 *   https://api.studio.thegraph.com/query/<USER_ID>/mediproof/v0.0.1
 */

const GRAPH_URL = import.meta.env.VITE_GRAPH_URL || '';

/**
 * Execute a GraphQL query against the subgraph
 */
async function gql(query, variables = {}) {
  if (!GRAPH_URL) throw new Error('VITE_GRAPH_URL not configured');

  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Graph request failed: ${res.statusText}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

// ─── Queries ──────────────────────────────────────────────────────────────

/**
 * Fetch global stats from the subgraph
 * @returns {{ totalBatches, totalManufacturers, totalReports, totalRecalls, suspiciousBatches }}
 */
export async function fetchGlobalStats() {
  const data = await gql(`{
    mediProofStats(id: "global") {
      totalBatches
      totalManufacturers
      totalReports
      totalRecalls
      suspiciousBatches
    }
  }`);
  return data.mediProofStats;
}

/**
 * Fetch recent batch registrations
 */
export async function fetchRecentBatches(limit = 10) {
  const data = await gql(`{
    batches(first: ${limit}, orderBy: createdAt, orderDirection: desc) {
      id
      ipfsHash
      expiryDate
      isRecalled
      isSuspicious
      reportCount
      createdAt
      manufacturer {
        id
        name
        licenseNumber
      }
    }
  }`);
  return data.batches || [];
}

/**
 * Fetch recent reports
 */
export async function fetchRecentReports(limit = 10) {
  const data = await gql(`{
    reports(first: ${limit}, orderBy: timestamp, orderDirection: desc) {
      id
      reason
      timestamp
      reporter
      batch {
        id
        manufacturer { name }
      }
    }
  }`);
  return data.reports || [];
}

/**
 * Fetch batches by a specific manufacturer
 */
export async function fetchManufacturerBatches(address, limit = 20) {
  const data = await gql(`
    query($addr: String!) {
      manufacturer(id: $addr) {
        name
        licenseNumber
        registeredAt
        totalBatches
        batches(first: ${limit}, orderBy: createdAt, orderDirection: desc) {
          id
          ipfsHash
          expiryDate
          isRecalled
          isSuspicious
          reportCount
          createdAt
        }
      }
    }
  `, { addr: address.toLowerCase() });
  return data.manufacturer;
}

/**
 * Fetch suspicious batches (isSuspicious: true)
 */
export async function fetchSuspiciousBatches(limit = 10) {
  const data = await gql(`{
    batches(where: { isSuspicious: true }, first: ${limit}, orderBy: reportCount, orderDirection: desc) {
      id
      reportCount
      isRecalled
      manufacturer { name }
    }
  }`);
  return data.batches || [];
}

export const isGraphConfigured = () => Boolean(GRAPH_URL);
