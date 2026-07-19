"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address, PaymentMethod } from "@/lib/types";
import {
  emptyAddressForm,
  type AddressForm,
} from "@/components/address/AddressSelector";

export interface PendingPayment {
  razorpayOrderId: string;
  vantooOrderId: string;
  paymentAttemptId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  failedAt: string;
  failureReason?: string;
  razorpayPaymentId?: string;
}

export interface VerifyingPayment {
  razorpayOrderId: string;
  vantooOrderId: string;
  paymentAttemptId: string;
  razorpayPaymentId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  startedAt: string;
}

interface CheckoutState {
  checkoutReferenceId: string | null;
  addressForm: AddressForm;
  selectedAddressId: string | null;
  addressMode: "current" | "saved" | "new";
  deliveryAddress: Address | null;
  payment: PaymentMethod;
  deliveryNotes: string;
  deliverySlot: string;
  pendingPayment: PendingPayment | null;
  verifyingPayment: VerifyingPayment | null;
  ensureCheckoutReference: () => string;
  setAddressForm: (form: AddressForm) => void;
  setSelectedAddressId: (id: string | null) => void;
  setAddressMode: (mode: "current" | "saved" | "new") => void;
  setDeliveryAddress: (address: Address | null) => void;
  setPayment: (payment: PaymentMethod) => void;
  setDeliveryNotes: (notes: string) => void;
  setDeliverySlot: (slot: string) => void;
  setPendingPayment: (payment: PendingPayment | null) => void;
  setVerifyingPayment: (payment: VerifyingPayment | null) => void;
  resetCheckout: () => void;
}

const initialState = {
  checkoutReferenceId: null as string | null,
  addressForm: emptyAddressForm,
  selectedAddressId: null as string | null,
  addressMode: "current" as const,
  deliveryAddress: null as Address | null,
  payment: "card" as PaymentMethod,
  deliveryNotes: "",
  deliverySlot: "",
  pendingPayment: null as PendingPayment | null,
  verifyingPayment: null as VerifyingPayment | null,
};

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initialState,
      ensureCheckoutReference: () => {
        const existing = get().checkoutReferenceId;
        if (existing) return existing;
        const id = `CHK-${crypto.randomUUID()}`;
        set({ checkoutReferenceId: id });
        return id;
      },
      setAddressForm: (form) => set({ addressForm: form }),
      setSelectedAddressId: (id) => set({ selectedAddressId: id }),
      setAddressMode: (mode) => set({ addressMode: mode }),
      setDeliveryAddress: (address) => set({ deliveryAddress: address }),
      setPayment: (payment) => set({ payment }),
      setDeliveryNotes: (notes) => set({ deliveryNotes: notes }),
      setDeliverySlot: (slot) => set({ deliverySlot: slot }),
      setPendingPayment: (payment) => set({ pendingPayment: payment }),
      setVerifyingPayment: (payment) => set({ verifyingPayment: payment }),
      resetCheckout: () => set(initialState),
    }),
    {
      name: "vantoo-checkout",
      partialize: (state) => ({
        checkoutReferenceId: state.checkoutReferenceId,
        addressForm: state.addressForm,
        selectedAddressId: state.selectedAddressId,
        addressMode: state.addressMode,
        deliveryAddress: state.deliveryAddress,
        payment: state.payment,
        deliveryNotes: state.deliveryNotes,
        deliverySlot: state.deliverySlot,
        pendingPayment: state.pendingPayment,
        verifyingPayment: state.verifyingPayment,
      }),
    }
  )
);
