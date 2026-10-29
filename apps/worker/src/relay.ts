/**
 * Drives the outbox relay: runs a drain when woken, never two at once, and keeps draining while full batches
 * come back. A wake that arrives mid-drain schedules exactly one more pass, so no event waits for the poll.
 */
export function createRelayLoop(drain: () => Promise<number>, onError: (error: unknown) => void) {
  let running = false;
  let again = false;

  async function run() {
    if (running) {
      again = true;
      return;
    }
    running = true;
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
      running = false;
    }
  }

  return { wake: () => void run(), run };
}
