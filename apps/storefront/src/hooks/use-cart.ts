"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { create } from "zustand";

import {
  getCartId,
  removeCartId,
  setCartId as setCartCookie,
} from "@/lib/cart-cookie";
import type { CheckoutRequest } from "@repo/codegen/client/types.gen";

import {
  addCartItem,
  checkoutCart,
  clearCart,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/storefront-api";

import { useCartStore } from "./use-cart-store";

// ── Legacy in-memory cart store (used by old shop/[category]/[slug] routes) ──

interface LegacyCartItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

interface LegacyCartState {
  items: LegacyCartItem[];
  addItem: (
    product_id: string,
    name: string,
    price: number,
    image?: string,
    quantity?: number,
  ) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
}

export const useCart = create<LegacyCartState>((set) => ({
  items: [],
  addItem: (product_id, name, price, image, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product_id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === product_id
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          ),
        };
      }
      return {
        items: [...state.items, { product_id, name, price, image, quantity }],
      };
    }),
  removeItem: (product_id) =>
    set((state) => ({
      items: state.items.filter((i) => i.product_id !== product_id),
    })),
  clear: () => set({ items: [] }),
}));

function useTenant() {
  const params = useParams();
  return (params?.tenant ?? "") as string;
}

export function useCartQuery() {
  const tenantSlug = useTenant();
  const cartId = useCartStore((s) => s.cartId);

  const queryKey = useMemo(
    () => ["cart", tenantSlug, cartId],
    [tenantSlug, cartId],
  );

  return useQuery({
    queryKey,
    queryFn: () => getCart(tenantSlug, cartId!),
    enabled: !!cartId && !!tenantSlug,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAddToCart() {
  const tenantSlug = useTenant();
  const queryClient = useQueryClient();
  const { setCartId, setProcessing } = useCartStore();

  return useMutation({
    mutationFn: async ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity?: number;
    }) => {
      setProcessing(true);
      const existingCartId = getCartId(tenantSlug);
      if (existingCartId) {
        return addCartItem(tenantSlug, existingCartId, variantId, quantity);
      }
      const cart = await createCart(tenantSlug, variantId, quantity);
      setCartId(cart.id);
      setCartCookie(tenantSlug, cart.id);
      return cart;
    },
    onSuccess: () => {
      const cartId = getCartId(tenantSlug);
      if (cartId) {
        queryClient.invalidateQueries({
          queryKey: ["cart", tenantSlug, cartId],
        });
      }
    },
    onSettled: () => {
      setProcessing(false);
    },
  });
}

export function useUpdateQuantity() {
  const tenantSlug = useTenant();
  const queryClient = useQueryClient();
  const cartId = useCartStore((s) => s.cartId);

  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(tenantSlug, cartId!, itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cart", tenantSlug, cartId],
      });
    },
  });
}

export function useRemoveFromCart() {
  const tenantSlug = useTenant();
  const queryClient = useQueryClient();
  const cartId = useCartStore((s) => s.cartId);

  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(tenantSlug, cartId!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cart", tenantSlug, cartId],
      });
    },
  });
}

export function useClearCart() {
  const tenantSlug = useTenant();
  const queryClient = useQueryClient();
  const { setCartId } = useCartStore();

  return useMutation({
    mutationFn: async (cartId: string) => {
      await clearCart(tenantSlug, cartId);
      removeCartId(tenantSlug);
      setCartId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCheckout() {
  const tenantSlug = useTenant();
  const queryClient = useQueryClient();
  const { setCartId } = useCartStore();

  return useMutation({
    mutationFn: ({
      cartId,
      ...data
    }: { cartId: string } & Partial<CheckoutRequest>) =>
      checkoutCart(tenantSlug, cartId, data),
    onSuccess: () => {
      removeCartId(tenantSlug);
      setCartId(null);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
