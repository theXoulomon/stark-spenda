// gasless.ts - Avnu Gasless SDK utility functions
import { 
  fetchAccountCompatibility, 
  fetchGasTokenPrices,
  executeCalls,
} from '@avnu/gasless-sdk';
import type { AccountInterface } from 'starknet';

export const SUPPORTED_GAS_TOKENS = {
  USDC: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'
} as const;

export async function checkGaslessCompatibility(
  accountAddress: string
): Promise<boolean> {
  try {
    const compatibility = await fetchAccountCompatibility(accountAddress);
    return compatibility.isCompatible;
  } catch (error) {
    console.error('Error checking gasless compatibility:', error);
    return false;
  }
}

export async function getGasTokenPrices() {
  try {
    return await fetchGasTokenPrices();
  } catch (error) {
    console.error('Error fetching gas token prices:', error);
    throw error;
  }
}

export async function executeGaslessCalls(
  account: AccountInterface,
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
  maxGasTokenAmount: bigint = BigInt(10_000) // 0.01 USDC default max
) {
  try {
    const response = await executeCalls(account, calls, {
      gasTokenAddress: SUPPORTED_GAS_TOKENS.USDC,
      maxGasTokenAmount,
    });
    
    return response.transactionHash;
  } catch (error) {
    console.error('Error executing gasless transaction:', error);
    throw error;
  }
}