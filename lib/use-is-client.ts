"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the hydration pass, true afterwards.
 *
 * Used for values that legitimately differ between server and client — kickoff
 * times, which the server renders in Eastern and the browser re-renders in the
 * viewer's own zone. Doing it this way keeps the hydrated markup identical to
 * the server's instead of patching it from an effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
