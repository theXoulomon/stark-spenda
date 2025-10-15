'use client';

import { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { Address } from "@starknet-react/chains";
import { useAccount } from "~~/hooks/useAccount";
import { TokenBalance } from "~~/components/scaffold-stark/TokenBalance";
import { useTheme } from "next-themes";

// ==================== TYPES ====================
interface Token {
  symbol: string;
  name: string;
  decimals: number;
  contract: string;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

interface Institution {
  code: string;
  name: string;
}

interface SwapQuote {
  id: string;
  quote: {
    min_receive_amount: string;
  };
}

interface WalletState {
  instance: any | null;
  address: string | null;
  isConnected: boolean;
}

interface TradeFormData {
  token: string;
  amount: string;
  currency: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  isFiatInput: boolean;
}

// ==================== CONFIGURATION ====================
const CONFIG = {
  API: {
    LAYERSWAP: 'https://api.layerswap.io/api/v2',
    PAYCREST: 'https://api.paycrest.io/v1',
  },
  KEYS: {
    LAYERSWAP: process.env.NEXT_PUBLIC_LAYERSWAP_API_KEY || '',
    PAYCREST: process.env.NEXT_PUBLIC_PAYCREST_API_KEY || '',
  },
  NETWORKS: {
    SOURCE: 'STARKNET_MAINNET',
    DESTINATION: 'BASE_MAINNET',
  },
  BASE_ADDRESS: '0xb39b7c02372dBBb003c05D6b4ABA2eC68842934D',
  TOKENS: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contract: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      decimals: 6,
      contract: '0x068f5c6a61780768455de69077e917e519ada645a524dd210e42a555b3a4e6d4',
    },
    {
      symbol: 'DAI',
      name: 'Dai',
      decimals: 18,
      contract: '0x05574eb6b8789a91466f902c380d978e472db68170ff82a5b650b95a58ddf4ad',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      contract: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    },
  ] as Token[],
} as const;

// ==================== UTILITIES ====================
class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const formatters = {
  address: (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  amount: (amount: string | number, decimals = 2): string => {
    return Number(amount).toFixed(decimals);
  },

  decimalToHex: (decimal: number, padding = 0): string => {
    return '0x' + decimal.toString(16).padStart(padding, '0');
  },
};

const errorHandler = {
  parse: (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      if (axiosError.response) {
        const { status, data } = axiosError.response;
        
        if (data?.error) return data.error;
        if (data?.message) return data.message;
        
        switch (status) {
          case 400:
            return 'Invalid request. Please check your input.';
          case 401:
            return 'Authentication failed. Please check your API credentials.';
          case 429:
            return 'Too many requests. Please try again later.';
          case 500:
          case 502:
          case 503:
            return 'Service temporarily unavailable. Please try again.';
          default:
            return `Request failed with status ${status}`;
        }
      }
      
      if (axiosError.request) {
        return 'Network error. Please check your connection.';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  },
};

// ==================== API SERVICES ====================
const layerSwapService = {
  createSwap: async (params: {
    sourceToken: string;
    destinationToken: string;
    amount: string;
  }): Promise<SwapQuote> => {
    const response = await axios.post(
      `${CONFIG.API.LAYERSWAP}/swaps`,
      {
        source_network: CONFIG.NETWORKS.SOURCE,
        source_token: params.sourceToken,
        destination_token: params.destinationToken,
        destination_network: CONFIG.NETWORKS.DESTINATION,
        refuel: true,
        amount: params.amount,
        destination_address: CONFIG.BASE_ADDRESS,
      },
      {
        headers: {
          'X-LS-APIKEY': CONFIG.KEYS.LAYERSWAP,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  },

  getSwapDetails: async (swapId: string): Promise<any> => {
    const response = await axios.get(
      `${CONFIG.API.LAYERSWAP}/swaps/${swapId}`,
      {
        headers: {
          'X-LS-APIKEY': CONFIG.KEYS.LAYERSWAP,
        },
      }
    );
    return response.data.data;
  },
};

const paycrestService = {
  getCurrencies: async (): Promise<Currency[]> => {
    const response = await axios.get(`${CONFIG.API.PAYCREST}/currencies`, {
      headers: { 'API-Key': CONFIG.KEYS.PAYCREST },
    });
    return response.data.data;
  },

  getInstitutions: async (currency: string): Promise<Institution[]> => {
    const response = await axios.get(
      `${CONFIG.API.PAYCREST}/institutions/${currency}`,
      {
        headers: { 'API-Key': CONFIG.KEYS.PAYCREST },
      }
    );
    return response.data.data;
  },

  verifyAccount: async (
    institution: string,
    accountIdentifier: string
  ): Promise<string> => {
    const response = await axios.post(
      `${CONFIG.API.PAYCREST}/verify-account`,
      { institution, accountIdentifier },
      {
        headers: {
          'API-Key': CONFIG.KEYS.PAYCREST,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  },

  getRate: async (
    token: string,
    amount: string,
    currency: string,
    network = 'base'
  ): Promise<number> => {
    const response = await axios.get(
      `${CONFIG.API.PAYCREST}/rates/${token}/${amount}/${currency}?network=${network}`,
      {
        headers: { 'API-Key': CONFIG.KEYS.PAYCREST },
      }
    );
    return response.data.data;
  },

  createOrder: async (orderData: any): Promise<any> => {
    const response = await axios.post(
      `${CONFIG.API.PAYCREST}/sender/orders`,
      orderData,
      {
        headers: {
          'API-Key': CONFIG.KEYS.PAYCREST,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  },
};

const baseService = {
  completeTrade: async (tradeData: {
    swapId: string;
    token: string;
    currency: string;
    bankCode: string;
    accountIdentifier: string;
    accountName: string;
  }): Promise<{ success: boolean; txHash: string }> => {
    const response = await axios.post('/api/complete-base-trade', tradeData);
    return response.data;
  },
};

// ==================== CUSTOM HOOKS ====================
const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T,>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = errorHandler.parse(err);
      setError(errorMessage);
      console.error('Operation failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, execute, reset };
};

const useStarknetWallet = () => {
  const { account, address, status, isConnected } = useAccount();

  const executeTransaction = useCallback(
    async (calls: any[]) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const result = await account.execute(calls);
      return result;
    },
    [account]
  );

  return {
    instance: account,
    address,
    isConnected,
    executeTransaction,
  };
};

// ==================== UI COMPONENTS ====================
const Button = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}) => {
  const baseStyles =
    'px-6 py-3 rounded-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:shadow-lg hover:scale-105'
      : 'bg-gray-700 text-white hover:bg-gray-600';

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {loading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Processing...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  helperText,
  error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  error?: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <div className="mb-6">
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${isDarkMode ? 'bg-cyan-500/10 border-cyan-500 text-white focus:shadow-cyan-500/50' : 'bg-blue-50 border-blue-300 text-gray-900 focus:shadow-blue-500/50'} border-2 px-4 py-3 rounded-lg w-full focus:outline-none focus:shadow-lg transition-all disabled:opacity-50`}
      />
      {helperText && (
        <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{helperText}</p>
      )}
      {error && <p className={`mt-2 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>}
    </div>
  );
};

const Select = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Choose an option...',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <div className="mb-6">
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${isDarkMode ? 'bg-cyan-500/10 border-cyan-500 text-white focus:shadow-cyan-500/50' : 'bg-blue-50 border-blue-300 text-gray-900 focus:shadow-blue-500/50'} border-2 px-4 py-3 rounded-lg w-full focus:outline-none focus:shadow-lg transition-all disabled:opacity-50`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const Card = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <div
      className={`${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl p-8 shadow-2xl border ${className}`}
    >
      {children}
    </div>
  );
};

const StatusBadge = ({
  status,
  text,
}: {
  status: 'connected' | 'disconnected' | 'verified';
  text: string;
}) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  const colors = {
    connected: 'bg-green-400',
    disconnected: isDarkMode ? 'bg-gray-500' : 'bg-gray-400',
    verified: 'bg-blue-400',
  };

  return (
    <div className="flex items-center space-x-3">
      <div
        className={`w-3 h-3 rounded-full animate-pulse ${colors[status]}`}
      />
      <span className={`${isDarkMode ? 'text-white' : 'text-gray-900'} font-semibold`}>{text}</span>
    </div>
  );
};

const PayoutDisplay = ({
  amount,
  currency,
  loading,
}: {
  amount: string;
  currency: string;
  loading: boolean;
}) => {
  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-cyan-500/20 to-purple-600/20 border border-cyan-500 rounded-lg p-6 backdrop-blur-lg">
        <div className="text-center">
          <p className="text-sm text-gray-300 mb-2">Estimated Payout</p>
          {loading ? (
            <p className="text-2xl font-bold text-blue-400 animate-pulse">
              Calculating...
            </p>
          ) : amount ? (
            <p className="text-3xl font-bold text-green-400">
              {formatters.amount(amount, 2)} {currency}
            </p>
          ) : (
            <p className="text-xl text-gray-500">Enter amount to see payout</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function StarknetOffRamp() {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const wallet = useStarknetWallet();
  const operation = useAsyncOperation();

  const [formData, setFormData] = useState<TradeFormData>({
    token: 'USDC',
    amount: '',
    currency: '',
    bank: '',
    accountNumber: '',
    accountName: '',
    isFiatInput: false,
  });

  const [appState, setAppState] = useState({
    currencies: [] as Currency[],
    institutions: [] as Institution[],
    estimatedPayout: '',
    swapQuote: null as SwapQuote | null,
  });

  // Load initial data
  useEffect(() => {
    loadCurrencies();
  }, []);

  // Load institutions when currency changes
  useEffect(() => {
    if (formData.currency) {
      loadInstitutions();
    }
  }, [formData.currency]);

  // Verify account when account number is entered
  useEffect(() => {
    if (formData.accountNumber.length >= 10 && formData.bank) {
      verifyAccount();
    }
  }, [formData.accountNumber, formData.bank]);

  // Calculate payout when amount changes
  useEffect(() => {
    if (formData.amount && formData.token && formData.currency) {
      calculatePayout();
    }
  }, [formData.amount, formData.token, formData.currency]);

  const updateFormData = (updates: Partial<TradeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const loadCurrencies = async () => {
    const currencies = await operation.execute(() =>
      paycrestService.getCurrencies()
    );
    if (currencies) {
      setAppState((prev) => ({ ...prev, currencies }));
    }
  };

  const loadInstitutions = async () => {
    const institutions = await operation.execute(() =>
      paycrestService.getInstitutions(formData.currency)
    );
    if (institutions) {
      setAppState((prev) => ({ ...prev, institutions }));
    }
  };

  const verifyAccount = async () => {
    const accountName = await operation.execute(() =>
      paycrestService.verifyAccount(formData.bank, formData.accountNumber)
    );
    if (accountName) {
      updateFormData({ accountName });
    }
  };

  const calculatePayout = async () => {
    let cryptoAmount = formData.amount;

    if (formData.isFiatInput) {
      const rate = await operation.execute(() =>
        paycrestService.getRate(formData.token, '1', formData.currency)
      );
      if (rate) {
        cryptoAmount = (parseFloat(formData.amount) / rate).toString();
      } else {
        return;
      }
    }

    const swap = await operation.execute(() =>
      layerSwapService.createSwap({
        sourceToken: formData.token,
        destinationToken: formData.token,
        amount: cryptoAmount,
      })
    );

    if (swap) {
      const payoutRate = await operation.execute(() =>
        paycrestService.getRate(
          formData.token,
          swap.quote.min_receive_amount,
          formData.currency
        )
      );

      if (payoutRate) {
        const payout =
          parseFloat(swap.quote.min_receive_amount) * payoutRate;
        setAppState((prev) => ({
          ...prev,
          swapQuote: swap,
          estimatedPayout: payout.toString(),
        }));
      }
    }
  };

  // const handleWalletConnect = async () => {
  //   // Wallet connection is handled by the useAccount hook and wallet provider
  //   // No need for manual connect call
  // };

  const handleTrade = async () => {
    if (!wallet.instance || !appState.swapQuote) return;

    const result = await operation.execute(async () => {
      const swapDetails = await layerSwapService.getSwapDetails(
        appState.swapQuote!.id
      );
      const callData = swapDetails.deposit_actions[0].call_data;

      const calls = [
        {
          contractAddress: formatters.decimalToHex(
            callData.contract_address,
            64
          ),
          entrypoint: callData.entrypoint,
          calldata: callData.calldata.map((item: number) =>
            formatters.decimalToHex(item, 0)
          ),
        },
      ];

      await wallet.executeTransaction(calls);

      const baseResult = await baseService.completeTrade({
        swapId: appState.swapQuote!.id,
        token: formData.token,
        currency: formData.currency,
        bankCode: formData.bank,
        accountIdentifier: formData.accountNumber,
        accountName: formData.accountName,
      });

      return baseResult;
    });

    if (result) {
      alert(`Trade completed successfully! Tx Hash: ${result.txHash}`);
    }
  };

  const isFormValid =
    wallet.isConnected &&
    formData.currency &&
    formData.bank &&
    formData.accountNumber &&
    formData.amount &&
    formData.accountName;

  return (
    <div className={`min-h-screen p-4 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className={`text-4xl font-bold mb-2 tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            STARKNET OFF-RAMP
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Bridge your stablecoins from Starknet to fiat currencies
          </p>
        </div>

        <Card>
          {/* Wallet Connection */}
          {/* <div className="mb-6">
            {!wallet.isConnected ? (
              <Button
                onClick={handleWalletConnect}
                loading={operation.loading}
                className="w-full text-lg"
              >
                Connect Starknet Wallet
              </Button>
            ) : (
              <div className={`flex items-center justify-between rounded-lg p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <StatusBadge status="connected" text="Connected" />
                <span className={`font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {formatters.address(wallet.address || '')}
                </span>
              </div>
            )}
          </div> */}

          {wallet.isConnected && (
            <>
              {/* Token Selection */}
              <Select
                label="Select Token"
                value={formData.token}
                onChange={(value) => updateFormData({ token: value })}
                options={CONFIG.TOKENS.map((t) => ({
                  value: t.symbol,
                  label: `${t.symbol} - ${t.name}`,
                }))}
              />

              {/* Token Balance Display */}
              {wallet.address && formData.token && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your Balance
                  </label>
                  <div className="bg-gradient-to-r from-cyan-500/20 to-purple-600/20 border border-cyan-500 rounded-lg p-4 backdrop-blur-lg">
                    <div className="flex items-center justify-center">
                      <TokenBalance
                        address={wallet.address}
                        tokenTicker={formData.token}
                        className="text-2xl font-bold text-green-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Currency Selection */}
              <Select
                label="Select Fiat Currency"
                value={formData.currency}
                onChange={(value) => updateFormData({ currency: value })}
                options={appState.currencies.map((c) => ({
                  value: c.code,
                  label: `${c.name} (${c.symbol})`,
                }))}
                placeholder="Choose currency..."
              />

              {/* Bank Selection */}
              <Select
                label="Select Bank Institution"
                value={formData.bank}
                onChange={(value) => updateFormData({ bank: value })}
                options={appState.institutions.map((i) => ({
                  value: i.code,
                  label: i.name,
                }))}
                disabled={!formData.currency}
                placeholder="Choose bank..."
              />

              {/* Account Number */}
              <Input
                label="Account Number/Identifier"
                value={formData.accountNumber}
                onChange={(value) => updateFormData({ accountNumber: value })}
                placeholder="Enter account number..."
                helperText={
                  formData.accountName
                    ? `✓ Account Name: ${formData.accountName}`
                    : undefined
                }
              />

              {/* Trade Amount */}
              <Input
                label="Trade Amount"
                type="number"
                value={formData.amount}
                onChange={(value) => updateFormData({ amount: value })}
                placeholder={`Enter amount in ${
                  formData.isFiatInput ? formData.currency : formData.token
                }...`}
              />

              {/* Payout Display */}
              <PayoutDisplay
                amount={appState.estimatedPayout}
                currency={formData.currency}
                loading={operation.loading}
              />

              {/* Trade Button */}
              <Button
                onClick={handleTrade}
                loading={operation.loading}
                disabled={!isFormValid}
                className="w-full text-xl py-4"
              >
                Initiate Trade
              </Button>

              {/* Error Display */}
              {operation.error && (
                <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-red-500/10 border-red-500' : 'bg-red-50 border-red-300'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{operation.error}</p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Footer */}
        <div className={`text-center mt-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          <p>Powered by LayerSwap & Paycrest APIs</p>
        </div>
      </div>
    </div>
  );
}