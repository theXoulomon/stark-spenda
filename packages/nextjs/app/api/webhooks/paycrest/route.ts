import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import type { PaycrestWebhookBody } from "@/types/offramp";

export async function POST(req: Request) {
  try {
    // Verify Paycrest signature
    const signature = req.headers.get("x-paycrest-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    const body = await req.text();
    const isValid = verifySignature(
      body,
      signature,
      process.env.PAYCREST_WEBHOOK_SECRET!
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body) as PaycrestWebhookBody;

    // Handle different webhook events
    switch (payload.status) {
      case "validated":
        // Order complete - fiat sent
        console.log("Fiat payment sent:", payload.orderId);
        break;
      
      case "settled":
        // Blockchain transaction settled
        console.log("Blockchain settled:", payload.orderId);
        break;
      
      case "refunded":
        // Payment refunded
        console.log("Payment refunded:", payload.orderId);
        break;
      
      case "expired":
        // Order expired
        console.log("Order expired:", payload.orderId);
        break;
    }

    // Here you would update your database with the new status
    // await prisma.order.update({
    //   where: { id: payload.orderId },
    //   data: { status: payload.status }
    // });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  const calculated = hmac.update(payload).digest("hex");
  return signature === calculated;
}