import { CLIENT_IP_HEADER } from '@teamflow/auth';

/**
 * Put the client address the server observed in `CLIENT_IP_HEADER`, replacing anything the client sent there
 * itself; with no address, remove the header. Edits the request in place: Bun keeps a header that is only missing
 * from a copy's `init.headers`.
 */
export function withClientIp(request: Request, address: string | null | undefined): Request {
  if (address) request.headers.set(CLIENT_IP_HEADER, address);
  else request.headers.delete(CLIENT_IP_HEADER);
  return request;
}
