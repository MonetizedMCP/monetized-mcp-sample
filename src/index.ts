import {
  MonetizedMCPServer,
  PaymentMethodResponse,
  PriceListingResponse,
  MakePurchaseRequest,
  MakePurchaseResponse,
  PaymentsTools,
  PaymentMethods,
  PriceListingRequest,
} from "monetizedmcp-sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { purchasableItems } from "./purchasableItems.js";
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class MCPServer extends MonetizedMCPServer {
  pricingListing(
    pricingListingRequest: PriceListingRequest
  ): Promise<PriceListingResponse> {
    const filteredItems = purchasableItems.filter((item) => {
      return item.name
        .toLowerCase()
        .includes(pricingListingRequest.searchQuery?.toLowerCase() ?? "");
    });
    return Promise.resolve({
      items: filteredItems,
    });
  }
  paymentMethod(): Promise<PaymentMethodResponse[]> {
    return Promise.resolve([
      {
        walletAddress: "0x069B0687C879b8E9633fb9BFeC3fea684bc238D5",
        paymentMethod: PaymentMethods.USDC_BASE_SEPOLIA,
      },
    ]);
  }
  async makePurchase(
    purchaseRequest: MakePurchaseRequest
  ): Promise<MakePurchaseResponse> {
    try {
      const paymentTools = new PaymentsTools();
      const amount = purchasableItems.find(
        (item) =>
          item.id === purchaseRequest.itemId &&
          item.price.paymentMethod === purchaseRequest.paymentMethod
      )?.price.amount;

      if (!amount) {
        return Promise.resolve({
          purchasableItemId: purchaseRequest.itemId,
          makePurchaseRequest: purchaseRequest,
          orderId: uuidv4(),
          toolResult: "Invalid item ID",
        });
      }

      const payment = await paymentTools.verifyAndSettlePayment(
        amount,
        "0x069B0687C879b8E9633fb9BFeC3fea684bc238D5",
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
          url: "https://api.pdfshift.io/v3/convert/pdf",
          responseType: "arraybuffer",
          data: {
            source: purchaseRequest.params!.websiteUrl,
          },
          auth: { username: "api", password: process.env.PDFSHIFT_API_KEY! },
        });

        const pdfBuffer = response.data;
        pdfBuffers.push(pdfBuffer);

        // Upload to S3
        const fileName = `pdf-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.pdf`;
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: fileName,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        });

        await s3Client.send(command);
        const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        s3Urls.push(s3Url);
        return Promise.resolve({
          purchasableItemId: purchaseRequest.itemId,
          makePurchaseRequest: purchaseRequest,
          orderId: uuidv4(),
          toolResult: JSON.stringify({
            pdfs: s3Urls.map((url) => ({ type: "pdf", url })),
          }),
        });
      }
      console.log("Error:", payment.error);
      return Promise.resolve({
        purchasableItemId: purchaseRequest.itemId,
        makePurchaseRequest: purchaseRequest,
        orderId: uuidv4(),
        toolResult: "Payment failed",
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  constructor() {
    super();
    super.runMonetizeMCPServer();
  }
}

new MCPServer();
