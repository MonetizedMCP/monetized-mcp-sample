import { v4 as uuidv4 } from "uuid";
import { PaymentMethods } from "monetizedmcp-sdk";

export const purchasableItems = [
    {
      id: uuidv4(),
      name: "Convert to PDF",
      description: "Convert a website to a PDF",
      price: {
        amount: 0.5,
        paymentMethod: PaymentMethods.USDC_BASE_SEPOLIA,
      },
      params: {
        websiteUrl: "Example: https://en.wikipedia.org/wiki/PDF",
      },
    },
  ]