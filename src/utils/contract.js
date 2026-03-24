import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import ABI from '../abi/MediProof.json';

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 10143);
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://testnet-rpc.monad.xyz';

let readProvider;

export const MONAD_TESTNET = {
  chainId: `0x${CHAIN_ID.toString(16)}`,
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

/**
 * Switch or add Monad Testnet to MetaMask
 */
export async function switchToMonad(ethereum = window.ethereum) {
  if (!ethereum) throw new Error('No wallet provider found');

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET.chainId }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [MONAD_TESTNET],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Get a read-only contract instance (no signer needed)
 */
export function getReadContract() {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  }
  return new Contract(CONTRACT_ADDRESS, ABI, readProvider);
}

/**
 * Get a write contract instance (requires signer / connected wallet)
 */
export async function getWriteContract() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}
