import { 
  type Account,
  createPublicClient, 
  createWalletClient, 
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

/**
 * Formats and validates a private key string
 * @param privateKey - Raw private key string
 * @returns Properly formatted 0x-prefixed private key
 * @throws {Error} If private key is invalid
 */
export function formatPrivateKey(privateKey?: string): `0x${string}` {
  if (!privateKey) {
    throw new Error("Private key is required");
  }

  // Add 0x prefix if missing
  const formattedKey = privateKey.startsWith("0x") ? 
    privateKey : 
    `0x${privateKey}`;

  // Validate hex format - must be 0x + 64 hex chars
  if (!/^0x[0-9a-fA-F]{64}$/.test(formattedKey)) {
    throw new Error("Invalid private key format");
  }

  return formattedKey as `0x${string}`;
}

/**
 * Creates a viem wallet account from private key
 * @param privateKey - Raw or 0x-prefixed private key
 * @returns Viem Account instance
 */
export function createWalletAccount(privateKey: string): Account {
  return privateKeyToAccount(formatPrivateKey(privateKey));
}

/**
 * Creates initialized viem public and wallet clients for a chain
 * @param chain - Viem chain configuration
 * @param privateKey - Private key for wallet client
 * @returns Tuple of [publicClient, walletClient]
 */
export function createChainClients(
  chain: Chain,
  privateKey: string
): [PublicClient, WalletClient] {
  const account = createWalletAccount(privateKey);
  
  const publicClient = createPublicClient({
    chain,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain, 
    transport: http()
  });

  return [publicClient, walletClient];
}

// Base chain client factory
export function createBaseClients(privateKey: string) {
  return createChainClients(base, privateKey);
}
