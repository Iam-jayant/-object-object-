import axios from 'axios';

const PINATA_API_KEY    = import.meta.env.VITE_PINATA_API_KEY    || '';
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY || '';
const PINATA_BASE_URL   = 'https://api.pinata.cloud';
const IPFS_GATEWAY      = 'https://gateway.pinata.cloud/ipfs';

/**
 * Upload a single File to IPFS via Pinata
 * @param {File} file
 * @returns {Promise<string>} ipfsHash (CID)
 */
export async function uploadToIPFS(file) {
  const formData = new FormData();
  formData.append('file', file);

  const metadata = JSON.stringify({ name: file.name });
  formData.append('pinataMetadata', metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  formData.append('pinataOptions', options);

  const response = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
    formData,
    {
      headers: {
        'pinata_api_key':        PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        'Content-Type':          'multipart/form-data',
      },
      maxBodyLength: Infinity,
    }
  );

  return response.data.IpfsHash;
}

/**
 * Upload multiple files and return an array of IPFS hashes
 * @param {File[]} files
 * @returns {Promise<string[]>}
 */
export async function uploadMultipleToIPFS(files) {
  return Promise.all(files.map(uploadToIPFS));
}

/**
 * Upload JSON metadata to IPFS
 * @param {object} json
 * @returns {Promise<string>} ipfsHash
 */
export async function uploadJSONToIPFS(json) {
  const response = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
    { pinataContent: json, pinataMetadata: { name: 'batch-metadata.json' } },
    {
      headers: {
        'pinata_api_key':        PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        'Content-Type':          'application/json',
      },
    }
  );

  return response.data.IpfsHash;
}

/**
 * Return a public HTTPS URL for an IPFS hash
 * @param {string} hash CID
 * @returns {string}
 */
export function getIPFSUrl(hash) {
  if (!hash) return '';
  // Support both raw CID and full ipfs:// URI
  const cid = hash.startsWith('ipfs://') ? hash.slice(7) : hash;
  return `${IPFS_GATEWAY}/${cid}`;
}
