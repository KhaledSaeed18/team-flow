import { v7 } from 'uuid';

/** Time-ordered UUID v7: index-friendly, sortable by creation, not a secret. */
export const newId = (): string => v7();
