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

  console.error(JSON.stringify(payload));

  const webhookUrl = getErrorReportWebhookUrl();
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (webhookError) {
    console.error(JSON.stringify({
      level: "error",
      context: "error-report-webhook",
      error: serializeError(webhookError),
    }));
  }
}
