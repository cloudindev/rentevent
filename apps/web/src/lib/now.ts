/** Current time. Server components render per request, so reading the clock is intended. */
export const now = (): number => Date.now();
