const SIGNAL_EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
} as const;

type ManagedSignal = keyof typeof SIGNAL_EXIT_CODES;

export interface ProcessSignalController {
  readonly getSignal: () => AbortSignal;
  readonly getAbortExitCode: (error: unknown) => number | undefined;
  readonly dispose: () => void;
}

export function createProcessSignal(
  externalSignal?: AbortSignal,
): ProcessSignalController {
  let controller: AbortController | undefined;
  let resolved: AbortSignal | undefined;
  let received: ManagedSignal | undefined;
  let detach: (() => void) | undefined;

  function onSignal(sig: ManagedSignal): void {
    if (received) {
      detach?.();
      if (process.platform === "win32") {
        process.exit(SIGNAL_EXIT_CODES[sig]);
      }
      process.kill(process.pid, sig);

      return;
    }
    received = sig;
    controller!.abort(new Error(`Process interrupted by ${sig}`));
  }

  return {
    getSignal() {
      if (!resolved) {
        controller = new AbortController();
        const onSigInt = () => onSignal("SIGINT");
        const onSigTerm = () => onSignal("SIGTERM");
        process.on("SIGINT", onSigInt);
        process.on("SIGTERM", onSigTerm);
        detach = () => {
          process.off("SIGINT", onSigInt);
          process.off("SIGTERM", onSigTerm);
          detach = undefined;
        };
        resolved = externalSignal
          ? AbortSignal.any([controller.signal, externalSignal])
          : controller.signal;
      }

      return resolved;
    },

    getAbortExitCode(error) {
      if (!received || !controller?.signal.aborted) {
        return undefined;
      }
      if (
        error === controller.signal.reason ||
        (Error.isError(error) && error.name === "AbortError")
      ) {
        return SIGNAL_EXIT_CODES[received];
      }

      return undefined;
    },

    dispose() {
      detach?.();
    },
  };
}
