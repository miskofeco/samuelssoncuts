import type { Instrumentation } from "next";

// Next.js server-error hook. Every uncaught error in a Server Component, Route
// Handler, or Server Action is funneled here and forwarded to the observability
// layer (structured stderr + optional webhook / Sentry). This is the single
// choke point that turns "an error happened somewhere" into an alertable event.
//
// To add Sentry later: `npm i @sentry/nextjs`, add its config files, and call
// `Sentry.captureRequestError(err, request, context)` here — it composes with
// the reportError call below.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const { reportError } = await import("@/lib/observability");
  await reportError("request-error", err, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
