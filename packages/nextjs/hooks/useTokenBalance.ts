import { Address } from "@starknet-react/chains";
import { useDeployedContractInfo } from "./scaffold-stark/useDeployedContractInfo";
import { useReadContract } from "@starknet-react/core";
import { BlockNumber } from "starknet";
import { Abi } from "abi-wan-kanabi";
import { formatUnits } from "ethers";

type UseTokenBalanceProps = {
  address?: Address | string;
  tokenTicker?: string;
};

/**
 * Fetches Token token balance for a given address.
 * This hook reads the balance_of function from the Token token contract
 * and provides both raw and formatted balance values.
 *
 * @param config - Configuration object for the hook
 * @param config.address - The address to check Token balance for (optional)
 * @returns {Object} An object containing:
 *   - value: bigint - The raw balance as bigint
 *   - decimals: number - Token decimals (18)
 *   - symbol: string - Token symbol ("Token")
 *   - formatted: string - Formatted balance as string, defaults to "0" if no data
 *   - error: Error | null - Any error encountered during the read operation
 *   - (All other properties from useReadContract)
 * @see {@link https://scaffoldstark.com/docs/hooks/useScaffoldStrkBalance}
 */

const useTokenBalance = ({ address, tokenTicker }: UseTokenBalanceProps) => {
  const { data: deployedContract } = useDeployedContractInfo(tokenTicker);

  const { data, ...props } = useReadContract({
    functionName: "balance_of",
    address: deployedContract?.address,
    abi: deployedContract?.abi as Abi as any[],
    watch: true,
    enabled: true,
    args: address ? [address] : [],
    blockIdentifier: "pre_confirmed" as BlockNumber,
  });

  let token_decimals = tokenTicker === "USDT" || tokenTicker === "USDC" ? 6 : tokenTicker === "ETH" || tokenTicker === "DAI"  ? 18 : 18 ;

  return {
    value: data as unknown as bigint,
    decimals: token_decimals,
    symbol: tokenTicker,
    formatted: data ? formatUnits(data as unknown as bigint, token_decimals ) : "0",
    ...props,
  };
};

export default useTokenBalance;
