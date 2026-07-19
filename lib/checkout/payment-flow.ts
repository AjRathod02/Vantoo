import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Address, PaymentMethod } from "@/lib/types";
import type { CartItem } from "@/lib/types";
import { toast } from "@/lib/stores/toast";
import {
  openRazorpayCheckout,
  razorpayMethodForPayment,
} from "@/lib/payments/razorpay-client";
import { buildOrderPayload, createVantooOrder } from "@/lib/checkout/order-api";
import type { useCheckoutStore } from "@/lib/stores/checkout";
import { markNavigatingToOrderSuccess } from "@/lib/checkout/success-nav";

type CheckoutStore = ReturnType<typeof useCheckoutStore.getState>;

interface PlaceOrderParams {
  items: CartItem[];
  totals: {
    subtotal: number;
    deliveryFee: number;
    tax: number;
    discount: number;
    total: number;
  };
  payment: PaymentMethod;
  selectedAddress: Address;
  addressMode: "current" | "saved" | "new";
  savedAddresses: Address[];
  addAddress: (address: Address) => void;
  user: { name?: string; email?: string; phone?: string } | null;
  checkoutStore: CheckoutStore;
  clearCart: () => void;
  router: AppRouterInstance;
  onPlacingChange: (placing: boolean) => void;
}

function saveAddressIfNew(
  address: Address,
  addressMode: "current" | "saved" | "new",
  savedAddresses: Address[],
  addAddress: (address: Address) => void
) {
  if (addressMode !== "new") return;
  const exists = savedAddresses.some(
    (a) =>
      a.line1 === address.line1 &&
      a.pincode === address.pincode &&
      a.label === address.label
  );
  if (!exists) {
    addAddress({ ...address, isDefault: savedAddresses.length === 0 });
  }
}

function redirectToSuccess(
  router: AppRouterInstance,
  orderId: string,
  paymentId?: string
) {
  markNavigatingToOrderSuccess();
  const params = new URLSearchParams({ orderId });
  if (paymentId) params.set("paymentId", paymentId);
  // replace beats any competing replace("/cart") from empty-cart guards
  router.replace(`/order/success?${params.toString()}`);
}

function redirectToPaymentFailed(
  router: AppRouterInstance,
  reason?: string
) {
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  const qs = params.toString();
  router.replace(qs ? `/payment/failed?${qs}` : "/payment/failed");
}

function redirectToVerifying(router: AppRouterInstance, razorpayOrderId: string) {
  router.replace(`/checkout/verifying?orderId=${encodeURIComponent(razorpayOrderId)}`);
}

async function completeVerifiedPayment({
  verified,
  items,
  totals,
  payment,
  selectedAddress,
  addressMode,
  savedAddresses,
  addAddress,
  checkoutStore,
  clearCart,
  router,
  onPlacingChange,
}: PlaceOrderParams & {
  verified: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    order: { id: string };
  };
}) {
  if (checkoutStore.checkoutReferenceId) {
    const existingKey = `completed:${checkoutStore.checkoutReferenceId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(existingKey)) {
      const orderId = sessionStorage.getItem(existingKey)!;
      redirectToSuccess(router, orderId, verified.razorpayPaymentId);
      onPlacingChange(false);
      return;
    }
  }

  const { order } = verified;

  if (checkoutStore.checkoutReferenceId && typeof window !== "undefined") {
    sessionStorage.setItem(
      `completed:${checkoutStore.checkoutReferenceId}`,
      order.id
    );
  }

  saveAddressIfNew(selectedAddress, addressMode, savedAddresses, addAddress);
  // Navigate first, then clear cart — guards check isNavigatingToOrderSuccess()
  redirectToSuccess(router, order.id, verified.razorpayPaymentId);
  clearCart();
  checkoutStore.resetCheckout();
  onPlacingChange(false);
}

export async function placeOrder(params: PlaceOrderParams) {
  const {
    items,
    totals,
    payment,
    selectedAddress,
    addressMode,
    savedAddresses,
    addAddress,
    user,
    checkoutStore,
    clearCart,
    router,
    onPlacingChange,
  } = params;

  onPlacingChange(true);
  const checkoutReferenceId = checkoutStore.ensureCheckoutReference();

  try {
    if (payment === "cod") {
      const { order } = await createVantooOrder(
        buildOrderPayload({
          items,
          totals,
          payment,
          address: selectedAddress,
          service: items[0].product.service,
          extra: {
            paymentStatus: "pending",
            idempotencyKey: checkoutReferenceId,
          },
        })
      );
      saveAddressIfNew(selectedAddress, addressMode, savedAddresses, addAddress);
      redirectToSuccess(router, order.id);
      clearCart();
      checkoutStore.resetCheckout();
      onPlacingChange(false);
      return;
    }

    const payRes = await fetch("/api/payments/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        paymentMethod: payment,
        address: selectedAddress,
        service: items[0].product.service,
        idempotencyKey: checkoutReferenceId,
      }),
    });

    if (payRes.status === 401) {
      throw new Error("Session expired. Please sign in again.");
    }

    if (!payRes.ok) {
      const err = await payRes.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || "Payment gateway unavailable"
      );
    }

    const {
      orderId,
      vantooOrderId,
      paymentAttemptId,
      keyId,
      amount,
    } = await payRes.json();

    checkoutStore.setPendingPayment(null);
    checkoutStore.setVerifyingPayment(null);

    const rzp = await openRazorpayCheckout({
      key: keyId,
      amount,
      currency: "INR",
      name: "Vantoo",
      description: `Order · ${items.length} item(s)`,
      order_id: orderId,
      prefill: {
        name: user?.name,
        email: user?.email,
        contact: user?.phone,
      },
      theme: { color: "#FF6B00" },
      method:
        payment === "card" || payment === "upi" || payment === "netbanking"
          ? razorpayMethodForPayment(payment)
          : undefined,
      modal: {
        ondismiss: () => {
          onPlacingChange(false);
        },
      },
      handler: async (response) => {
        try {
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              ...response,
              vantoo_order_id: vantooOrderId,
              payment_attempt_id: paymentAttemptId,
            }),
          });

          if (!verifyRes.ok) {
            checkoutStore.setVerifyingPayment({
              razorpayOrderId: response.razorpay_order_id,
              vantooOrderId,
              paymentAttemptId,
              razorpayPaymentId: response.razorpay_payment_id,
              amount: totals.total,
              paymentMethod: payment,
              startedAt: new Date().toISOString(),
            });
            redirectToVerifying(router, response.razorpay_order_id);
            onPlacingChange(false);
            return;
          }

          const verified = await verifyRes.json();
          await completeVerifiedPayment({
            ...params,
            verified,
          });
        } catch {
          checkoutStore.setVerifyingPayment({
            razorpayOrderId: response.razorpay_order_id,
            vantooOrderId,
            paymentAttemptId,
            razorpayPaymentId: response.razorpay_payment_id,
            amount: totals.total,
            paymentMethod: payment,
            startedAt: new Date().toISOString(),
          });
          redirectToVerifying(router, response.razorpay_order_id);
          onPlacingChange(false);
        }
      },
    });

    rzp.on("payment.failed", (response) => {
      const reason =
        response.error?.description ||
        response.error?.reason ||
        "Payment was declined or cancelled";
      checkoutStore.setPendingPayment({
        razorpayOrderId: orderId,
        vantooOrderId,
        paymentAttemptId,
        amount: totals.total,
        paymentMethod: payment,
        failedAt: new Date().toISOString(),
        failureReason: reason,
      });
      onPlacingChange(false);
      redirectToPaymentFailed(router, reason);
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not place order");
    if (e instanceof Error && e.message.includes("sign in")) {
      router.push("/login?redirect=/checkout/review");
    }
    onPlacingChange(false);
  }
}

export async function retryPayment(params: PlaceOrderParams) {
  await placeOrder(params);
}

export async function verifyAndCompleteOrder(
  params: PlaceOrderParams & { razorpayOrderId: string; razorpayPaymentId?: string }
): Promise<"success" | "failed" | "pending"> {
  const { razorpayOrderId, razorpayPaymentId, checkoutStore, router, onPlacingChange, ...rest } =
    params;
  const paymentContext =
    checkoutStore.verifyingPayment ?? checkoutStore.pendingPayment;
  if (!paymentContext) return "pending";
  const ownershipParams =
    `&vantooOrderId=${encodeURIComponent(paymentContext.vantooOrderId)}` +
    `&paymentAttemptId=${encodeURIComponent(paymentContext.paymentAttemptId)}`;

  if (razorpayPaymentId) {
    try {
      const statusRes = await fetch(
        `/api/payments/razorpay/status?orderId=${encodeURIComponent(razorpayOrderId)}&paymentId=${encodeURIComponent(razorpayPaymentId)}${ownershipParams}`
      );
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.verified && status.razorpayPaymentId) {
          await completeVerifiedPayment({
            ...rest,
            checkoutStore,
            router,
            onPlacingChange,
            verified: {
              razorpayOrderId: status.razorpayOrderId,
              razorpayPaymentId: status.razorpayPaymentId,
              order: status.order,
            },
          });
          return "success";
        }
        if (status.status === "failed") {
          checkoutStore.setPendingPayment({
            razorpayOrderId,
            vantooOrderId: paymentContext.vantooOrderId,
            paymentAttemptId: paymentContext.paymentAttemptId,
            razorpayPaymentId,
            amount: rest.totals.total,
            paymentMethod: rest.payment,
            failedAt: new Date().toISOString(),
            failureReason: status.failureReason ?? "Payment failed",
          });
          return "failed";
        }
      }
    } catch {
      // fall through to status poll
    }
  }

  try {
    const statusRes = await fetch(
      `/api/payments/razorpay/status?orderId=${encodeURIComponent(razorpayOrderId)}${ownershipParams}`
    );
    if (!statusRes.ok) return "pending";

    const status = await statusRes.json();

    if (status.verified && status.razorpayPaymentId) {
      await completeVerifiedPayment({
        ...rest,
        checkoutStore,
        router,
        onPlacingChange,
        verified: {
          razorpayOrderId: status.razorpayOrderId,
          razorpayPaymentId: status.razorpayPaymentId,
            order: status.order,
        },
      });
      return "success";
    }

    if (status.status === "failed") {
      checkoutStore.setPendingPayment({
        razorpayOrderId,
        vantooOrderId: paymentContext.vantooOrderId,
        paymentAttemptId: paymentContext.paymentAttemptId,
        amount: rest.totals.total,
        paymentMethod: rest.payment,
        failedAt: new Date().toISOString(),
        failureReason: status.failureReason ?? "Payment failed",
      });
      return "failed";
    }

    return "pending";
  } catch {
    return "pending";
  }
}
