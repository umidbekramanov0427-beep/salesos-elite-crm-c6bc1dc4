// Client-side error capture. Fire-and-forget POST to /errors/log so any
// crash, anywhere in the app, ends up in Admin Panel -> Xatoliklar instead
// of only in the browser console.
export function logClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  void fetch("/errors/log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      stack,
      source: "client",
      route: window.location.pathname,
      context,
    }),
  }).catch(() => undefined);
}

export function installGlobalErrorLogging() {
  if (typeof window === "undefined" || window.__errorLoggingInstalled) return;
  window.__errorLoggingInstalled = true;

  window.addEventListener("error", (event) => {
    logClientError(event.error ?? event.message, { mechanism: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    logClientError(event.reason, { mechanism: "unhandledrejection" });
  });
}

declare global {
  interface Window {
    __errorLoggingInstalled?: boolean;
  }
}
