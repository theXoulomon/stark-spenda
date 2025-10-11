"use client";

import React, { useEffect, useState } from "react";
import { Address } from "@starknet-react/chains";
import { useAccount } from "~~/hooks/useAccount";
import axios from 'axios';



const CONSTANTS = {
    // API Endpoints (local proxy)
    LAYERSWAP_BASE_URL: 'https://api.layerswap.io/api/v2',

    PAYCREST_BASE_URL: 'https://api.paycrest.io/v1',
    
    // Contract Addresses (Starknet)
    STABLECOIN_CONTRACTS: {
        USDC: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        USDT: '0x068f5c6a61780768455de69077e917e519ada645a524dd210e42a555b3a4e6d4',
        DAI: '0x05574eb6b8789a91466f902c380d978e472db68170ff82a5b650b95a58ddf4ad',
        ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
    },
    
    // Base Network Configuration
    BASE_ADDRESS: '0xb39b7c02372dBBb003c05D6b4ABA2eC68842934D',


    
    // Supported Networks
    SOURCE_NETWORK: 'STARKNET_MAINNET',
    DESTINATION_NETWORK: 'BASE_MAINNET'
};

// ==================== UTILITY FUNCTIONS ====================
const utils = {
    // API Error Handling
    handleApiError: (error, customMessage) => {
        console.error(customMessage || 'API Error:', error);
        if (error.response) {
            const status = error.response.status;
            if (status === 400) {
                return 'Invalid request. Please check your input.';
            } else if (status === 401) {
                return 'Authentication failed. Please check your API key.';
            } else if (status === 429) {
                return 'Rate limit exceeded. Please try again later.';
            } else if (status >= 500) {
                return 'Server error. Please try again later.';
            }
        } else if (error.request) {
            return 'Network error. Please check your connection.';
        }
        return 'An unexpected error occurred.';
    },
    
    // Retry logic for API calls
    retryApiCall: async (apiCall, maxRetries = 3, delay = 1000) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    
};

// ==================== CUSTOM HOOKS ====================

// LayerSwap API Hook
const useLayerSwap = () => {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    
    const createSwap = async (params) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(
                `${CONSTANTS.API_BASE_URL}/api/layerswap/swaps`,
                {
                    source_network: CONSTANTS.SOURCE_NETWORK,
                    source_token: params.source_token,
                    destination_token: params.destination_token,
                    destination_network: CONSTANTS.DESTINATION_NETWORK,
                    refuel: true,
                    amount: params.amount,
                    destination_address: CONSTANTS.BASE_ADDRESS
                }
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to create swap'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    const getSwapDetails = async (swapId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(
                `${CONSTANTS.API_BASE_URL}/api/layerswap/swaps/${swapId}`
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to get swap details'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    return { createSwap, getSwapDetails, loading, error };
};

// Paycrest API Hook
const usePaycrest = () => {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    
    const getCurrencies = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(
                `${CONSTANTS.API_BASE_URL}/api/paycrest/currencies`
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to fetch currencies'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    const getInstitutions = async (currency) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(
                `${CONSTANTS.API_BASE_URL}/api/paycrest/institutions/${currency}`
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to fetch institutions'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    const verifyAccount = async (institution, accountIdentifier) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(
                `${CONSTANTS.API_BASE_URL}/api/paycrest/verify-account`,
                {
                    institution,
                    accountIdentifier
                }
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to verify account'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    const getRate = async (token, amount, currency, network = 'base') => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(
                `${CONSTANTS.API_BASE_URL}/api/paycrest/rates/${token}/${amount}/${currency}?network=${network}`
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to fetch rate'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    const createOrder = async (orderData) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(
                `${CONSTANTS.API_BASE_URL}/api/paycrest/sender/orders`,
                orderData
            );
            return response.data.data;
        } catch (err) {
            setError(utils.handleApiError(err, 'Failed to create order'));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    
    return { getCurrencies, getInstitutions, verifyAccount, getRate, createOrder, loading, error };
};

// Starknet Wallet Hook
const useStarknetWallet = () => {
    const [wallet, setWallet] = React.useState(null);
    const [address, setAddress] = React.useState(null);
    const [balance, setBalance] = React.useState('0');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    
    const getBalance = async (tokenAddress) => {
        if (!wallet || !address) return '0';
        
        try {
            const contract = new starknet.Contract(
                [
                    {
                        name: 'balanceOf',
                        type: 'function',
                        inputs: [{ name: 'account', type: 'felt' }],
                        outputs: [{ name: 'balance', type: 'Uint256' }]
                    }
                ],
                tokenAddress,
                wallet.provider
            );
            
            const balance = await contract.balanceOf(address);
            return utils.fromBaseUnits(balance.toString(), 6);
        } catch (err) {
            console.error('Error fetching balance:', err);
            return '0';
        }
    };
    
    const executeTransaction = async (calls) => {
        if (!wallet) throw new Error('Wallet not connected');
        
        try {
            const result = await wallet.account.execute(calls);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };
    
    return { wallet, address, balance, loading, error, connectWallet, getBalance, executeTransaction };
};

// ==================== UI COMPONENTS ====================

// Stablecoin Selector Component
const StablecoinSelector = ({ selectedToken, onSelect, balance }) => {
    const tokens = [
        { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { symbol: 'USDT', name: 'Tether', decimals: 6 },
        { symbol: 'DAI', name: 'Dai', decimals: 18 },
        { symbol: 'ETH', name: 'Ethereum', decimals: 18 }
    ];
    
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Stablecoin
            </label>
            <select
                value={selectedToken}
                onChange={(e) => onSelect(e.target.value)}
                className="futuristic-input text-white px-4 py-3 rounded-lg w-full focus:outline-none"
            >
                {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                        {token.symbol} - {token.name}
                    </option>
                ))}
            </select>
            {balance && (
                <div className="mt-2 text-sm text-gray-400">
                    Balance: {utils.formatAmount(balance)} {selectedToken}
                </div>
            )}
        </div>
    );
};

// Currency Selector Component
const CurrencySelector = ({ selectedCurrency, onSelect, currencies }) => {
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Fiat Currency
            </label>
            <select
                value={selectedCurrency}
                onChange={(e) => onSelect(e.target.value)}
                className="futuristic-input text-white px-4 py-3 rounded-lg w-full focus:outline-none"
                disabled={!currencies.length}
            >
                <option value="">Choose currency...</option>
                {currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                        {currency.name} ({currency.symbol})
                    </option>
                ))}
            </select>
        </div>
    );
};

// Bank Selector Component
const BankSelector = ({ selectedBank, onSelect, banks }) => {
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Bank Institution
            </label>
            <select
                value={selectedBank}
                onChange={(e) => onSelect(e.target.value)}
                className="futuristic-input text-white px-4 py-3 rounded-lg w-full focus:outline-none"
                disabled={!banks.length}
            >
                <option value="">Choose bank...</option>
                {banks.map(bank => (
                    <option key={bank.code} value={bank.code}>
                        {bank.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

// Account Input Component
const AccountInput = ({ value, onChange, accountName, loading }) => {
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Number/Identifier
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="futuristic-input text-white px-4 py-3 rounded-lg w-full focus:outline-none"
                placeholder="Enter account number..."
            />
            {accountName && (
                <div className="mt-2 text-sm text-green-400 fade-in">
                    ✓ Account Name: {accountName}
                </div>
            )}
            {loading && (
                <div className="mt-2 text-sm text-blue-400">
                    Verifying account...
                </div>
            )}
        </div>
    );
};

// Trade Form Component
const TradeForm = ({ 
    amount, 
    onAmountChange, 
    isFiatMode, 
    onToggleMode, 
    selectedToken, 
    selectedCurrency 
}) => {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                    Trade Amount
                </label>
                <div className="flex items-center space-x-2">
                    <span className={`text-sm ${isFiatMode ? 'text-gray-400' : 'text-white'}`}>
                        {selectedToken}
                    </span>
                    <button
                        onClick={onToggleMode}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFiatMode ? 'translate-x-6' : 'translate-x-1'}`}></span>
                    </button>
                    <span className={`text-sm ${isFiatMode ? 'text-white' : 'text-gray-400'}`}>
                        {selectedCurrency}
                    </span>
                </div>
            </div>
            <input
                type="number"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="futuristic-input text-white px-4 py-3 rounded-lg w-full focus:outline-none"
                placeholder={`Enter amount in ${isFiatMode ? selectedCurrency : selectedToken}...`}
                min="0"
                step="0.01"
            />
        </div>
    );
};

// Payout Display Component
const PayoutDisplay = ({ amount, currency, loading }) => {
    return (
        <div className="mb-6">
            <div className="holographic-display rounded-lg p-4">
                <div className="text-center">
                    <div className="text-sm text-gray-300 mb-2">Estimated Payout</div>
                    {loading ? (
                        <div className="text-2xl font-bold text-blue-400 pulse-animation">
                            Calculating...
                        </div>
                    ) : amount ? (
                        <div className="text-3xl font-bold text-green-400 neon-text">
                            {utils.formatAmount(amount)} {currency}
                        </div>
                    ) : (
                        <div className="text-xl text-gray-500">
                            Enter amount to see payout
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Trade Button Component
const TradeButton = ({ onClick, loading, disabled, text = "Initiate Trade" }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`neon-button text-white px-8 py-4 rounded-lg font-bold text-xl w-full transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
        >
            {loading ? (
                <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                </div>
            ) : (
                text
            )}
        </button>
    );
};

// ==================== MAIN APPLICATION ====================
const App = () => {
    // Wallet state
    const { wallet, address, connectWallet, getBalance, executeTransaction } = useStarknetWallet();
    
    // API hooks
    const { createSwap, getSwapDetails } = useLayerSwap();
    const { getCurrencies, getInstitutions, verifyAccount, getRate, createOrder } = usePaycrest();
    
    // UI state
    const [selectedToken, setSelectedToken] = React.useState('USDC');
    const [tokenBalance, setTokenBalance] = React.useState('0');
    const [currencies, setCurrencies] = React.useState([]);
    const [selectedCurrency, setSelectedCurrency] = React.useState('');
    const [banks, setBanks] = React.useState([]);
    const [selectedBank, setSelectedBank] = React.useState('');
    const [accountIdentifier, setAccountIdentifier] = React.useState('');
    const [accountName, setAccountName] = React.useState('');
    const [tradeAmount, setTradeAmount] = React.useState('');
    const [isFiatMode, setIsFiatMode] = React.useState(false);
    const [estimatedPayout, setEstimatedPayout] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [swapData, setSwapData] = React.useState(null);
    
    // Load currencies on mount
    React.useEffect(() => {
        loadCurrencies();
    }, []);
    
    // Load token balance when wallet or token changes
    React.useEffect(() => {
        if (address && selectedToken) {
            loadTokenBalance();
        }
    }, [address, selectedToken]);
    
    // Load banks when currency changes
    React.useEffect(() => {
        if (selectedCurrency) {
            loadBanks();
        }
    }, [selectedCurrency]);
    
    // Verify account when identifier reaches 10 characters
    React.useEffect(() => {
        if (accountIdentifier.length >= 10 && selectedBank) {
            verifyAccountDetails();
        }
    }, [accountIdentifier, selectedBank]);
    
    // Calculate payout when amount changes
    React.useEffect(() => {
        if (tradeAmount && selectedToken && selectedCurrency) {
            calculatePayout();
        }
    }, [tradeAmount, selectedToken, selectedCurrency]);
    
    const loadCurrencies = async () => {
        try {
            const data = await getCurrencies();
            setCurrencies(data);
        } catch (err) {
            console.error('Failed to load currencies:', err);
        }
    };
    
    const loadTokenBalance = async () => {
        try {
            const balance = await getBalance(CONSTANTS.STABLECOIN_CONTRACTS[selectedToken]);
            setTokenBalance(balance);
        } catch (err) {
            console.error('Failed to load token balance:', err);
            setTokenBalance('0');
        }
    };
    
    const loadBanks = async () => {
        try {
            const data = await getInstitutions(selectedCurrency);
            setBanks(data);
        } catch (err) {
            console.error('Failed to load banks:', err);
            setBanks([]);
        }
    };
    
    const verifyAccountDetails = async () => {
        try {
            const name = await verifyAccount(selectedBank, accountIdentifier);
            setAccountName(name);
        } catch (err) {
            console.error('Failed to verify account:', err);
            setAccountName('');
        }
    };
    
    const calculatePayout = async () => {
        if (!tradeAmount) return;
        
        try {
            let cryptoAmount = tradeAmount;
            if (isFiatMode) {
                // Convert fiat to crypto using current rate
                const rate = await getRate(selectedToken, 1, selectedCurrency);
                cryptoAmount = (parseFloat(tradeAmount) / parseFloat(rate)).toString();
            }
            
            // Create swap to get min receive amount
            const swap = await createSwap({
                source_token: selectedToken,
                destination_token: selectedToken,
                amount: cryptoAmount
            });
            
            setSwapData(swap);
            
            // Get rate for the min receive amount
            const payoutRate = await getRate(selectedToken, swap.quote.min_receive_amount, selectedCurrency);
            const payout = parseFloat(swap.quote.min_receive_amount) * parseFloat(payoutRate);
            setEstimatedPayout(payout.toString());
        } catch (err) {
            console.error('Failed to calculate payout:', err);
            setEstimatedPayout('');
        }
    };
    
    const handleTrade = async () => {
        if (!wallet || !swapData || !estimatedPayout) return;
        
        setLoading(true);
        try {
            // Get swap details with call_data
            const swapDetails = await getSwapDetails(swapData.id);
            
            // Prepare calls for Starknet execute
            const callData = swapDetails.deposit_actions[0].call_data;
            const calls = [{
                contractAddress: utils.decimalToHex(callData.contract_address, 64),
                entrypoint: callData.entrypoint,
                calldata: callData.calldata.map(item => utils.decimalToHex(item, 0))
            }];
            
            // Execute transaction on Starknet
            const result = await executeTransaction(calls);
            
            console.log('Starknet transaction executed:', result);
            
            // Call server to complete the Base trade
            const response = await axios.post(`${CONSTANTS.API_BASE_URL}/api/complete-base-trade`, {
                swapId: swapData.id,
                token: selectedToken,
                currency: selectedCurrency,
                bankCode: selectedBank,
                accountIdentifier: accountIdentifier,
                accountName: accountName
            });
            
            console.log('Base trade completed:', response.data);
            
            alert('Trade completed successfully! Tx Hash: ' + response.data.txHash);
        } catch (err) {
            console.error('Trade failed:', err);
            alert('Trade failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 neon-text" style={{fontFamily: 'Orbitron'}}>
                        STARKNET OFF-RAMP
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Bridge your stablecoins from Starknet to fiat currencies
                    </p>
                </div>
                
                {/* Main Card */}
                <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-700">
                    
                    {address && (
                        <>
                            {/* Stablecoin Selection */}
                            <StablecoinSelector
                                selectedToken={selectedToken}
                                onSelect={setSelectedToken}
                                balance={tokenBalance}
                            />
                            
                            {/* Currency Selection */}
                            <CurrencySelector
                                selectedCurrency={selectedCurrency}
                                onSelect={setSelectedCurrency}
                                currencies={currencies}
                            />
                            
                            {/* Bank Selection */}
                            <BankSelector
                                selectedBank={selectedBank}
                                onSelect={setSelectedBank}
                                banks={banks}
                            />
                            
                            {/* Account Input */}
                            <AccountInput
                                value={accountIdentifier}
                                onChange={setAccountIdentifier}
                                accountName={accountName}
                                loading={loading}
                            />
                            
                            {/* Trade Amount */}
                            <TradeForm
                                amount={tradeAmount}
                                onAmountChange={setTradeAmount}
                                isFiatMode={isFiatMode}
                                onToggleMode={() => setIsFiatMode(!isFiatMode)}
                                selectedToken={selectedToken}
                                selectedCurrency={selectedCurrency}
                            />
                            
                            {/* Payout Display */}
                            <PayoutDisplay
                                amount={estimatedPayout}
                                currency={selectedCurrency}
                                loading={loading}
                            />
                            
                            {/* Trade Button */}
                            <TradeButton
                                onClick={handleTrade}
                                loading={loading}
                                disabled={!address || !selectedCurrency || !selectedBank || !accountIdentifier || !tradeAmount || !accountName}
                            />
                        </>
                    )}
                </div>
                
                {/* Footer */}
                <div className="text-center mt-8 text-gray-500">
                    <p>Powered by LayerSwap & Paycrest APIs</p>
                </div>
            </div>
        </div>
    );
};

