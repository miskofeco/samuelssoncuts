import { getErrorReportWebhookUrl } from "@/lib/env";

type Fields = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

export function logEvent(event: string, fields: Fields = {}) {
  console.info(JSON.stringify({ level: "info", event, ...fields }));
}

export async function reportError(context: string, error: unknown, fields: Fields = {}) {
  const payload = {
    level: "error",
    context,
    error: serializeError(error),
    ...fields,
  };

  // Always emit structured JSON to stdout/stderr so a platform log drain
  // (Vercel, Datadog, etc.) captures it even when no webhook is configured.
  console.error(JSON.stringify(payload));

  const webhookUrl = getErrorReportWebhookUrl();
  if (!webhookUrl) return;

  // Bound the webhook call so a slow/hanging sink can't stall a request or a
  // server action. AbortSignal.timeout is supported in Node 18+ / edge runtime.
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch (webhookError) {
    console.error(JSON.stringify({
      level: "error",
      context: "error-report-webhook",
      error: serializeError(webhookError),
    }));
  }
}
