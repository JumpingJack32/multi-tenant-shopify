"use client";

import { useCart } from "@/hooks/use-cart";

export function Cart() {
  const { items, removeItem, clear } = useCart();

  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground rounded-lg p-4 shadow-lg">
      <div className="font-semibold">Cart ({total} items)</div>
      {items.map((item) => (
        <div key={item.product_id} className="flex items-center justify-between mt-2">
          <span>Item x{item.quantity}</span>
          <button
            onClick={() => removeItem(item.product_id)}
            className="text-sm underline"
          >
            Remove
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <button
          onClick={clear}
          className="text-sm underline mt-2 block"
        >
          Clear cart
        </button>
      )}
    </div>
  );
}
