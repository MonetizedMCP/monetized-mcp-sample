import {
  MonetizedMCPServer,
  PaymentMethodsResponse,
  PriceListingResponse,
  MakePurchaseRequest,
  MakePurchaseResponse,
  PaymentsTools,
  PaymentMethods,
  PriceListingRequest,
} from "monetizedmcp-sdk";
import {
  SERVER_WALLET_ADDRESS,
  PDFSHIFT_API_KEY,
  AWS_S3_BUCKET,
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  PDFSHIFT_URL,
} from "./constants.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
  filterPurchasableItems,
  findPurchasableItem,
  purchasableItems,
} from "./purchasableItems.js";
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export class MCPServer extends MonetizedMCPServer {
  async paymentMethods(): Promise<PaymentMethodsResponse[]> {
    return [
      {
        walletAddress: SERVER_WALLET_ADDRESS,
        paymentMethod: PaymentMethods.USDC_BASE_MAINNET,
      },
    ];
  }

  async priceListing(
    priceListingRequest: PriceListingRequest
  ): Promise<PriceListingResponse> {
    try {
      // If search query is provided, filter the purchasable items by name
      const items = filterPurchasableItems(priceListingRequest.searchQuery);

      return { items };
    } catch (error) {
      console.error("Error in priceListing:", error);
      throw new Error("Failed to get price listing");
    }
  }

  async makePurchase(
    purchaseRequest: MakePurchaseRequest
  ): Promise<MakePurchaseResponse> {
    try {
      const paymentTools = new PaymentsTools();
      const amount = findPurchasableItem(
        purchaseRequest.itemId,
        purchaseRequest.paymentMethod
      )?.price.amount;
      const orderId = uuidv4();

      if (!amount) {
        return {
          purchasableItemId: purchaseRequest.itemId,
          makePurchaseRequest: purchaseRequest,
          orderId: orderId,
          toolResult: "Invalid item ID",
        };
      }

      const payment = await paymentTools.verifyAndSettlePayment(
        amount,
        SERVER_WALLET_ADDRESS as `0x${string}`,
        {
          facilitatorUrl: "https://x402.org/facilitator",
          paymentHeader: purchaseRequest.signedTransaction,
          resource: "http://example.com",
          paymentMethod: purchaseRequest.paymentMethod,
        }
      );

      if (payment.success) {
        const pdfBuffers: Buffer[] = [];
        const s3Urls: string[] = [];

        const response = await axios.request({
          method: "post",
          url: PDFSHIFT_URL,
          responseType: "arraybuffer",
          data: {
            source: purchaseRequest.params!.websiteUrl,
          },
          auth: { username: "api", password: PDFSHIFT_API_KEY },
        });

        const pdfBuffer = response.data;
        pdfBuffers.push(pdfBuffer);

        // Upload to S3
        const fileName = `pdf-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.pdf`;
        const command = new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: fileName,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        });

        await s3Client.send(command);
        const s3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
        s3Urls.push(s3Url);
        return {
          purchasableItemId: purchaseRequest.itemId,
          makePurchaseRequest: purchaseRequest,
          orderId: orderId,
          toolResult: JSON.stringify({
            pdfs: s3Urls.map((url) => ({ type: "pdf", url })),
          }),
        };
      }
      return {
        purchasableItemId: purchaseRequest.itemId,
        makePurchaseRequest: purchaseRequest,
        orderId: orderId,
        toolResult: "Payment failed",
      };
    } catch (error) {
      throw error;
    }
  }

  constructor() {
    super();
    super.runMonetizeMCPServer();
  }
}

new MCPServer();
