"use client";

import { create } from "zustand";

interface CartUIState {
  cartId: string | null;
  isDrawerOpen: boolean;
  isProcessing: boolean;
  setCartId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setProcessing: (processing: boolean) => void;
}

export const useCartStore = create<CartUIState>((set) => ({
  cartId: null,
  isDrawerOpen: false,
  isProcessing: false,
  setCartId: (cartId) => set({ cartId }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  setProcessing: (isProcessing) => set({ isProcessing }),
}));
