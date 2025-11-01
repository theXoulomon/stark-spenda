import { type Address } from "viem";

export type OffRampRequest = {
  swapId: string;
  token: "USDC" | "USDT" | "DAI" | "ETH";
  amount: string;
  fiatCurrency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  userStarknetAddress: Address;
  destinationFiatAmount: string;
};

export type LayerSwapAction = {
  type: string;
  to_address: string;
  amount: number;
  amount_in_base_units: string;
  call_data: string;
  network: {
    name: string;
    chain_id: string;
    type: string;
  };
  token: {
    symbol: string;
    contract: string;
    decimals: number;
  };
};

export type LayerSwapQuote = {
  receive_amount: number;
  min_receive_amount: number;
  blockchain_fee: number;
  service_fee: number;
  total_fee: number;
};

export type LayerSwapResponse = {
  data: {
    deposit_actions: LayerSwapAction[];
    swap: {
      id: string;
      status: string;
      metadata: {
        sequence_number: number;
      };
    };
    quote: LayerSwapQuote;
  };
};

export type PaycrestRate = {
  rate: number;
  fee: {
    sender: number;
    transaction: number;
  };
};

export type PaycrestOrder = {
  id: string;
  receiveAddress: string;
  validUntil: string;
  senderFee: number;
  transactionFee: number;
  status: PaycrestOrderStatus;
};

export type PaycrestOrderStatus = 
  | "pending"
  | "validated" 
  | "settled"
  | "refunded"
  | "expired";

export type PaycrestWebhookBody = {
  orderId: string;
  status: PaycrestOrderStatus;
  timestamp: string;
  signature: string;
};