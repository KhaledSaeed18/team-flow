import { type FormEvent, useState } from 'react';

/** Form submission state: runs `action`, exposes pending and a user-facing error message. */
export function useSubmit(action: (data: FormData) => Promise<string | null | undefined | void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const message = await action(new FormData(event.currentTarget));
      if (message) setError(message);
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return { onSubmit, pending, error, setError };
}

export const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
