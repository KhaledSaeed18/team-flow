import { CLIENT_IP_HEADER } from '@teamflow/auth';

/**
 * Put the client address the server observed in `CLIENT_IP_HEADER`, replacing anything the client sent there
 * itself; with no address, remove the header. Edits the request in place: Bun keeps a header that is only missing
 * from a copy's `init.headers`.
 */
export function withClientIp(request: Request, address: string | null | undefined): Request {
  const normal = address ? plainAddress(address) : null;
  if (normal) request.headers.set(CLIENT_IP_HEADER, normal);
  else request.headers.delete(CLIENT_IP_HEADER);
  return request;
}

/**
 * IPv4 written as IPv4: `::ffff:203.0.113.5` becomes `203.0.113.5` and the loopback `::1` becomes `127.0.0.1`.
 * Better Auth groups IPv6 addresses by /64 for rate limiting and stores them masked, which turned every local
 * session's address into a row of zeros.
 */
export function plainAddress(address: string): string {
  if (address === '::1') return '127.0.0.1';
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped?.[1] ?? address;
}
