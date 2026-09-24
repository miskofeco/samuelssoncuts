"use client";

// Rebind a browser's existing endpoint to the currently signed-in account.
// This never asks for notification permission or creates a subscription.
export async function persistPushSubscription(subscription: PushSubscription): Promise<boolean> {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return response.ok;
}
