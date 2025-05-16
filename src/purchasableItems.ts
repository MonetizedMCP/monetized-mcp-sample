import { PaymentMethods } from "monetizedmcp-sdk";

export const purchasableItems = [
    {
      id: "1",
      name: "Convert to PDF",
      description: "Convert a website to a PDF",
      price: {
        amount: 0.1,
        paymentMethod: PaymentMethods.USDC_BASE_SEPOLIA,
      },
      params: {
        websiteUrl: "Example: https://en.wikipedia.org/wiki/PDF",
      },
    },
  ]