import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { switchToMonad, CHAIN_ID } from '../utils/contract';

const WalletContext = createContext(null);

const STORAGE_KEY = 'mediproof_last_account';

// ── Detect available injected wallets ────────────────────────────────────────
export function detectWallets() {
  const wallets = [];
  const eth = window.ethereum;
  if (!eth) return wallets;

  // EIP-6963 multi-provider: if MetaMask & Coinbase are both installed,
  // window.ethereum.providers is an array.
  const providers = eth.providers ?? [eth];

  for (const p of providers) {
    if (p.isMetaMask && !p.isCoinbaseWallet) {
      wallets.push({ id: 'metamask', label: 'MetaMask', provider: p, icon: '🦊' });
    } else if (p.isCoinbaseWallet) {
      wallets.push({ id: 'coinbase', label: 'Coinbase Wallet', provider: p, icon: '🔵' });
    } else if (p.isBraveWallet) {
      wallets.push({ id: 'brave', label: 'Brave Wallet', provider: p, icon: '🦁' });
    } else if (p.isRabby) {
      wallets.push({ id: 'rabby', label: 'Rabby', provider: p, icon: '🐰' });
    } else {
      wallets.push({ id: 'injected', label: 'Browser Wallet', provider: p, icon: '🔐' });
    }
  }

  // De-duplicate by id (keep first)
  return wallets.filter((w, i, arr) => arr.findIndex(x => x.id === w.id) === i);
}

// ── Context ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }) {
  const [account,   setAccount]   = useState(null);
  const [balance,   setBalance]   = useState(null); // formatted ETH string
  const [chainId,   setChainId]   = useState(null);
  const [provider,  setProvider]  = useState(null); // active EIP-1193 provider
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const isCorrectChain = chainId === CHAIN_ID;

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function fetchBalance(ethProvider, addr) {
    try {
      const bp = new BrowserProvider(ethProvider);
      const raw = await bp.getBalance(addr);
      setBalance(Number(formatEther(raw)).toFixed(4));
    } catch {
      setBalance(null);
    }
  }

  function attachListeners(ethProvider) {
    const handleAccounts = (accounts) => {
      if (accounts[0]) {
        setAccount(accounts[0]);
        localStorage.setItem(STORAGE_KEY, accounts[0]);
        fetchBalance(ethProvider, accounts[0]);
      } else {
        _reset();
      }
    };

    const handleChain = (chain) => setChainId(Number(chain));

    ethProvider.on('accountsChanged', handleAccounts);
    ethProvider.on('chainChanged',    handleChain);

    return () => {
      ethProvider.removeListener('accountsChanged', handleAccounts);
      ethProvider.removeListener('chainChanged',    handleChain);
    };
  }

  function _reset() {
    setAccount(null);
    setBalance(null);
    setChainId(null);
    setProvider(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Connect (called with a specific wallet object from detectWallets) ─────

  const connect = useCallback(async (wallet) => {
    setLoading(true);
    setError(null);
    try {
      const ethProvider = wallet?.provider ?? window.ethereum;
      if (!ethProvider) throw new Error('No wallet found. Please install MetaMask.');

      await switchToMonad(ethProvider);

      const bp        = new BrowserProvider(ethProvider);
      const accounts  = await bp.send('eth_requestAccounts', []);
      const network   = await bp.getNetwork();
      const addr      = accounts[0];

      setAccount(addr);
      setChainId(Number(network.chainId));
      setProvider(ethProvider);
      localStorage.setItem(STORAGE_KEY, addr);
      await fetchBalance(ethProvider, addr);
    } catch (err) {
      setError(err.message ?? 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => _reset(), []);

  // ── Switch network ────────────────────────────────────────────────────────

  const switchNetwork = useCallback(async () => {
    const ethProvider = provider ?? window.ethereum;
    if (!ethProvider) return;
    try {
      await switchToMonad(ethProvider);
    } catch (err) {
      setError(err.message);
    }
  }, [provider]);

  // ── Auto-restore on mount ─────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const eth   = window.ethereum;
    if (!saved || !eth) return;

    const ethProvider = eth.providers?.[0] ?? eth;

    ethProvider
      .request({ method: 'eth_accounts' })
      .then(async (accounts) => {
        if (accounts[0]?.toLowerCase() === saved.toLowerCase()) {
          const chainHex = await ethProvider.request({ method: 'eth_chainId' });
          setAccount(accounts[0]);
          setChainId(Number(chainHex));
          setProvider(ethProvider);
          fetchBalance(ethProvider, accounts[0]);
        }
      })
      .catch(() => {});
  }, []);

  // ── Attach event listeners to active provider ─────────────────────────────

  useEffect(() => {
    if (!provider) return;
    return attachListeners(provider);
  }, [provider]);

  return (
    <WalletContext.Provider value={{
      account, balance, chainId, isCorrectChain,
      loading, error,
      connect, disconnect, switchNetwork,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
