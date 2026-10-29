/** Fired by the `c` shortcut; the board opens its quick add in the first unstarted column. */
export const CREATE_TASK_EVENT = 'teamflow:create-task';

let pendingCreate = false;

/**
 * Ask the board for quick add. The request is also remembered, because the shortcut may navigate to the board first
 * and the board then mounts after the event has fired.
 */
export function requestCreateTask() {
  pendingCreate = true;
  window.dispatchEvent(new CustomEvent(CREATE_TASK_EVENT));
}

/** True once per request: the board that opens quick add takes it. */
export function takeCreateRequest(): boolean {
  const pending = pendingCreate;
  pendingCreate = false;
  return pending;
}
