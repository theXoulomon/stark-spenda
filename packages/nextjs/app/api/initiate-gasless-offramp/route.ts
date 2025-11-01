import { NextResponse } from "next/server";
import { parseAbi, type Address } from "viem";
import axios from "axios";
import { rateLimit } from "@/utils/rateLimit";
import { pollWithTimeout, exponentialBackoff } from "@/utils/polling";
import { 
  checkGaslessCompatibility, 
  getGasTokenPrices, 
  executeGaslessCalls 
} from "@/utils/gasless";
import { createBaseClients, CONTRACT_ADDRESSES } from "@/utils/wallet";
import type { 
  OffRampRequest, 
  LayerSwapResponse,
  PaycrestRate,
  PaycrestOrder,
  LayerSwapAction,
  PaycrestOrderStatus
} from "@/types/offramp";

// Constants
const LAYERSWAP_API = "https://api.layerswap.io/api/v2";
const PAYCREST_API = "https://api.paycrest.io/v1";
const AVNU_PAYMASTER = "https://starknet.avnu.run/paymaster";

// Initialize Base chain clients
const [baseClient, baseWallet] = createBaseClients(process.env.BASE_PRIVATE_KEY!);

// USDC ABI (minimal for transfer)
const usdcAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)"
]);

export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    await rateLimit(ip);

    // Parse and validate request
    const body = (await req.json()) as OffRampRequest;
    if (!validateRequest(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 1. Fetch LayerSwap swap details
    const layerSwapResponse = await fetchLayerSwapSwap(body.swapId);
    const { deposit_actions, swap, quote } = layerSwapResponse.data;
    const depositAction = deposit_actions[0];
    
    if (!depositAction || swap.status !== "user_transfer_pending") {
      return NextResponse.json({ error: "Invalid swap state" }, { status: 400 });
    }

    // 2. Execute gasless Starknet transfer via AVNU
    const calls = JSON.parse(depositAction.call_data);
    const starknetTxHash = await executeStarknetTransfer(
      calls,
      body.userStarknetAddress
    );

    // 3. Poll LayerSwap until bridge complete
    const bridgeResult = await pollLayerSwapStatus(body.swapId);
    if (bridgeResult.status === "failed") {
      return NextResponse.json({ error: "Bridge failed" }, { status: 500 });
    }

    // 4. Create Paycrest order
    const paycrestRate = await fetchPaycrestRate(
      body.token,
      quote.receive_amount.toString(),
      body.fiatCurrency
    );

    const paycrestOrder = await createPaycrestOrder({
      amount: quote.receive_amount,
      token: body.token,
      rate: paycrestRate.rate,
      recipient: {
        institution: body.bankCode,
        accountIdentifier: body.accountNumber,
        accountName: body.accountName,
        currency: body.fiatCurrency
      }
    });

    // 5. Execute Base transfer to Paycrest
    const baseTxHash = await executeBaseTransfer(
      paycrestOrder.receiveAddress,
      quote.receive_amount,
      paycrestOrder.senderFee,
      paycrestOrder.transactionFee
    );

    // 6. Poll Paycrest order status
    const finalStatus = await pollPaycrestStatus(paycrestOrder.id);

    return NextResponse.json({
      status: "success",
      starknetTxHash,
      baseTxHash,
      paycrestOrderId: paycrestOrder.id,
      finalStatus
    });

  } catch (error) {
    console.error("Off-ramp error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper Functions
async function fetchLayerSwapSwap(swapId: string): Promise<LayerSwapResponse> {
  const response = await axios.get(
    `${LAYERSWAP_API}/swaps/${swapId}`,
    {
      headers: {
        "X-LS-APIKEY": process.env.LAYERSWAP_API_KEY
      }
    }
  );
  return response.data;
}

async function executeStarknetTransfer(
  calls: any[],
  userAddress: string
): Promise<string> {
  // First check if account is compatible with gasless transactions
  const isCompatible = await checkGaslessCompatibility(userAddress);
  if (!isCompatible) {
    throw new Error("Account not compatible with gasless transactions");
  }

  // Get current gas prices to estimate max amount
  const gasPrices = await getGasTokenPrices();
  
  // Calculate conservative max gas amount in USDC (with 6 decimals)
  // This is an example - adjust based on your needs
  const maxGasTokenAmount = BigInt(500000); // 0.5 USDC

  // Execute the gasless transaction
  const txHash = await executeGaslessCalls(
    userAddress as any, // Need to get actual Account instance
    calls,
    maxGasTokenAmount
  );
  
  return txHash;
}

async function pollLayerSwapStatus(swapId: string) {
  return pollWithTimeout(
    async () => {
      const response = await axios.get(
        `${LAYERSWAP_API}/swaps/${swapId}`,
        {
          headers: {
            "X-LS-APIKEY": process.env.LAYERSWAP_API_KEY
          }
        }
      );
      return response.data.data.swap;
    },
    (result: { status: string }) => ["fulfilled", "completed", "failed"].includes(result.status),
    5000,  // 5s interval
    300000 // 5min timeout
  );
}

async function fetchPaycrestRate(
  token: string,
  amount: string,
  fiatCurrency: string
): Promise<PaycrestRate> {
  const response = await axios.get(
    `${PAYCREST_API}/rates/${token}/${amount}/${fiatCurrency}`,
    {
      params: { network: "base" },
      headers: {
        "X-API-KEY": process.env.PAYCREST_API_KEY
      }
    }
  );
  return response.data;
}

async function createPaycrestOrder(orderData: any): Promise<PaycrestOrder> {
  const response = await axios.post(
    `${PAYCREST_API}/sender/orders`,
    {
      ...orderData,
      network: "base",
      returnAddress: process.env.BASE_HOT_WALLET
    },
    {
      headers: {
        "X-API-KEY": process.env.PAYCREST_API_KEY
      }
    }
  );
  return response.data;
}

async function executeBaseTransfer(
  to: string,
  amount: number,
  senderFee: number,
  txFee: number
): Promise<`0x${string}`> {
  const totalAmount = BigInt(
    Math.floor((amount + senderFee + txFee) * Math.pow(10, 6))
  );

  const hash = await baseWallet.writeContract({
    address: CONTRACT_ADDRESSES.BASE.USDC,
    abi: usdcAbi,
    functionName: "transfer",
    args: [to as `0x${string}`, totalAmount]
  });

  await baseClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function pollPaycrestStatus(orderId: string): Promise<string> {
  return pollWithTimeout(
    async () => {
      const response = await axios.get(
        `${PAYCREST_API}/sender/orders/${orderId}`,
        {
          headers: {
            "X-API-KEY": process.env.PAYCREST_API_KEY
          }
        }
      );
      return response.data;
    },
    (result: { status: PaycrestOrderStatus }) => ["validated", "settled", "refunded", "expired"].includes(result.status),
    10000,  // 10s interval
    600000  // 10min timeout
  );
}

function validateRequest(body: OffRampRequest): boolean {
  const requiredFields = [
    "swapId",
    "token",
    "amount",
    "fiatCurrency",
    "bankCode",
    "accountNumber",
    "accountName",
    "userStarknetAddress",
    "destinationFiatAmount"
  ];

  return requiredFields.every(field => !!body[field as keyof OffRampRequest]);
}