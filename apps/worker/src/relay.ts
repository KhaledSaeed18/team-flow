/**
 * Drives the outbox relay: runs a drain when woken, never two at once, and keeps draining while full batches
 * come back. A wake that arrives mid-drain schedules exactly one more pass, so no event waits for the poll.
 */
export function createRelayLoop(drain: () => Promise<number>, onError: (error: unknown) => void) {
  let current: Promise<void> | null = null;
  let again = false;

  async function loop() {
    try {
      do {
        again = false;
        while ((await drain()) > 0) {
          // Keep going until a pass finds nothing left.
        }
      } while (again);
    } catch (error) {
      onError(error);
    } finally {
      current = null;
    }
  }

  /** Drain now, or join the drain already running (and ask it for one more pass). Resolves when it is done. */
  function run(): Promise<void> {
    if (current) {
      again = true;
      return current;
    }
    current = loop();
    return current;
  }

  return { wake: () => void run(), run };
}
