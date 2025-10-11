"use client";

import { useState } from "react";
import { Address } from "@starknet-react/chains";
import useTokenBalance from "~~/hooks/useTokenBalance";

type TokenBalanceProps = {
  address?: Address;
  tokenTicker?: string;
  className?: string;
};

/**
 * Display (Stables) balance of an address.
 */
export const TokenBalance = ({ address, tokenTicker, className = "" }: TokenBalanceProps) => {
  const {
    formatted: tokenFormatted,
    isLoading: tokenIsLoading,
    isError: tokenIsError,
    symbol: tokenSymbol,
  } = useTokenBalance({
    address,
    tokenTicker
  });


  if (!address || tokenIsLoading || tokenFormatted === null) {
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-md bg-slate-300 h-6 w-6"></div>
        <div className="flex items-center space-y-6">
          <div className="h-2 w-28 bg-slate-300 rounded-sm"></div>
        </div>
      </div>
    );
  }

  if (tokenIsError) {
    return (
      <div
        className={`border-2 border-gray-400 rounded-md px-2 flex flex-col items-center max-w-fit cursor-pointer`}
      >
        <div className="text-warning">Error</div>
      </div>
    );
  }


  return (
    <>
        <div className="w-full flex items-center justify-center">
            <div className="flex">
              <span>{parseFloat(tokenFormatted).toFixed(4)}</span>
              <span className="text-[0.8em] font-bold ml-1">{tokenSymbol}</span>
            </div>
        </div>

    </>
  );
};
