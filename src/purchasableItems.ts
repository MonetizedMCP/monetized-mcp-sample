import { PaymentMethods, PurchasableItem } from "monetizedmcp-sdk";

export const purchasableItems = [
  {
    id: "1",
    name: "Convert to PDF",
    description: "Convert a website to a PDF",
    price: {
      amount: 0.01,
      paymentMethod: PaymentMethods.USDC_BASE_MAINNET,
    },
    params: {
      websiteUrl: "Example: https://en.wikipedia.org/wiki/PDF",
    },
  },
];

export const purchasableItemsById = new Map<string, PurchasableItem>(
  purchasableItems.map((item) => [item.id, item])
);

export const purchasableItemsByIdAndPayment = new Map<string, PurchasableItem>(
  purchasableItems.map((item) => [
    `${item.id}:${item.price.paymentMethod}`,
    item,
  ])
);

export function filterPurchasableItems(
  searchQuery?: string
): PurchasableItem[] {
  if (!searchQuery || searchQuery.trim() === "") {
    return purchasableItems;
  }

  const lowerQuery = searchQuery.toLowerCase().trim();

  return purchasableItems.filter((item) =>
    item.name.toLowerCase().includes(lowerQuery)
  );
}

// Fast lookup function for purchase validation
export function findPurchasableItem(
  itemId: string,
  paymentMethod: string
): PurchasableItem | undefined {
  return purchasableItemsByIdAndPayment.get(`${itemId}:${paymentMethod}`);
}
