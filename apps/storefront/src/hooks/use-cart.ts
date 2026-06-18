"use client";

import { create } from "zustand";

interface CartItem {
  product_id: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product_id: string, quantity?: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  items: [],
  addItem: (product_id, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product_id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.product_id === product_id ? { ...i, quantity: i.quantity + quantity } : i,
          ),
        };
      }
      return { ...state, items: [...state.items, { product_id, quantity }] };
    }),
  removeItem: (product_id) =>
    set((state) => ({
      ...state,
      items: state.items.filter((i) => i.product_id !== product_id),
    })),
  clear: () => set({ items: [] }),
}));
