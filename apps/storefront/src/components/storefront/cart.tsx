"use client";

import { useCart } from "@/hooks/use-cart";

export function Cart() {
  const { items, removeItem, clear } = useCart();

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground rounded-lg p-4 shadow-lg">
      <div className="font-semibold">Cart ({itemCount} items)</div>
      {items.map((item) => (
        <div
          key={item.product_id}
          className="flex items-center justify-between mt-2 gap-4"
        >
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm opacity-80">
              £{item.price.toFixed(2)} x {item.quantity}
            </div>
            <div className="text-sm">
              £{(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
          <button
            onClick={() => removeItem(item.product_id)}
            className="text-sm underline"
          >
            Remove
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <>
          <div className="border-t border-primary-foreground/20 mt-3 pt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>£{total.toFixed(2)}</span>
          </div>
          <button onClick={clear} className="text-sm underline mt-2 block">
            Clear cart
          </button>
        </>
      )}
    </div>
  );
}
