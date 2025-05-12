import {
  MonetizedMCPServer,
  PaymentMethodResponse,
  PricingListingResponse,
  PurchaseRequest,
  PurchaseResponse,
  PaymentsTools,
} from "monetized-mcp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import axios from "axios";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class MCPServer extends MonetizedMCPServer {
  pricingListing(): Promise<PricingListingResponse> {
    return Promise.resolve({
      items: [
        {
          name: "Convert to PDF",
          description: "Convert a website to a PDF",
          price: 0.5,
          currency: "USDC",
          params: {
            websiteUrl: "Example: https://en.wikipedia.org/wiki/PDF",
          },
        },
      ],
    });
  }
  paymentMethod(): Promise<PaymentMethodResponse[]> {
    return Promise.resolve([
      {
        name: "USDC",
        description: "USDC",
        sellerAccountId: "0x069B0687C879b8E9633fb9BFeC3fea684bc238D5",
        paymentMethod: "USDC_BASE_SEPOLIA" as any,
      }
    ]);
  }
  async makePurchase(
    purchaseRequest: PurchaseRequest
  ): Promise<PurchaseResponse> {
    try {
      const paymentTools = new PaymentsTools();

      const payment = await paymentTools.verifyPayment(
        purchaseRequest.totalPrice,
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

        for (const item of purchaseRequest.items) {
          const response = await axios.request({
            method: "post",
            url: "https://api.pdfshift.io/v3/convert/pdf",
            responseType: "arraybuffer",
            data: {
              source: item.params!.websiteUrl,
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
        }

        return Promise.resolve({
          items: [
            {
              name: "Convert to PDF",
              description: "Convert a website to a PDF",
              price: 0.5,
              currency: "USDC",
              params: {},
            },
          ],
          purchaseRequest: purchaseRequest,
          orderId: "123",
          toolResult: JSON.stringify({
            pdfs: s3Urls.map((url) => ({ type: "pdf", url })),
          }),
        });
      }
      return Promise.resolve({
        items: [
          {
            name: "Convert to PDF",
            description: "Convert a website to a PDF",
            price: 0.5,
            currency: "USDC",
            params: {},
          },
        ],
        purchaseRequest: purchaseRequest,
        orderId: "123",
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
