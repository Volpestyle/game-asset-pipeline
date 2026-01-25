let registered = false;
const controller = new AbortController();

export function getShutdownSignal() {
  if (!registered && typeof process !== "undefined") {
    registered = true;
    const handleShutdown = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
  }

  return controller.signal;
}
