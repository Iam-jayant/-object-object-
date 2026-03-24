/**
 * Push Protocol (EPNS) utility for MediProof
 *
 * Required env vars:
 *   VITE_PUSH_CHANNEL_ADDRESS — your Push Protocol channel address (0x…)
 *   VITE_PUSH_ENV             — 'staging' or 'prod'
 *
 * Docs: https://push.org/docs
 */

export const PUSH_ENV     = import.meta.env.VITE_PUSH_ENV            || 'staging';
export const PUSH_CHANNEL = import.meta.env.VITE_PUSH_CHANNEL_ADDRESS || '';

const isPushConfigured = () => Boolean(PUSH_CHANNEL);

/**
 * Opt a user wallet into the MediProof Push channel
 * @param {import('ethers').Signer} signer — ethers signer from connected wallet
 */
export async function subscribeToChannel(signer) {
  if (!isPushConfigured()) throw new Error('VITE_PUSH_CHANNEL_ADDRESS not set');
  const { PushAPI } = await import('@pushprotocol/restapi');

  const user = await PushAPI.initialize(signer, { env: PUSH_ENV });
  await user.notification.subscribe(
    `eip155:1:${PUSH_CHANNEL}`,
    { settings: [] }
  );
}

/**
 * Unsubscribe a wallet from the channel
 */
export async function unsubscribeFromChannel(signer) {
  if (!isPushConfigured()) return;
  const { PushAPI } = await import('@pushprotocol/restapi');
  const user = await PushAPI.initialize(signer, { env: PUSH_ENV });
  await user.notification.unsubscribe(`eip155:1:${PUSH_CHANNEL}`);
}

/**
 * Send a recall notification (requires channel owner signer / backend delegate)
 * For production, trigger this from a backend service with the channel owner key.
 * @param {import('ethers').Signer} signer - channel owner signer
 * @param {{ batchId: string, manufacturer: string }} payload
 */
export async function sendRecallNotification(signer, { batchId, manufacturer }) {
  if (!isPushConfigured()) return;
  const { PushAPI } = await import('@pushprotocol/restapi');

  const user = await PushAPI.initialize(signer, { env: PUSH_ENV });
  await user.channel.send(['*'], {
    notification: {
      title: `⚠️ Batch Recalled: ${batchId}`,
      body:  `Manufacturer ${manufacturer} has recalled batch ${batchId}. Do not consume this product.`,
    },
    payload: {
      title: `Batch Recall Alert`,
      body:  `Batch ${batchId} recalled by ${manufacturer}.`,
      cta:   `https://mediproof.app/verify?batch=${batchId}`,
      img:   '',
    },
    channel: `eip155:1:${PUSH_CHANNEL}`,
  });
}

/**
 * Fetch notifications for a user wallet
 * @param {string} address — wallet address
 * @returns {Promise<Array>}
 */
export async function fetchNotifications(address) {
  if (!isPushConfigured()) return [];
  try {
    const { PushAPI } = await import('@pushprotocol/restapi');
    const notifications = await PushAPI.user.getFeeds({
      user:  `eip155:1:${address}`,
      env:   PUSH_ENV,
      spam:  false,
      page:  1,
      limit: 20,
    });
    return notifications || [];
  } catch {
    return [];
  }
}

export { isPushConfigured };
