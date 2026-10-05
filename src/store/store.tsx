import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface EumaeState {
  // Stage 0: the store skeleton. Stages 1+ add slices here,
  // one per group in the design-map inventory.
}

const emptyState: EumaeState = {};

interface StoreValue {
  state: EumaeState;
}

const StoreContext = createContext<StoreValue>({ state: emptyState });

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ state: emptyState }), []);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  return useContext(StoreContext);
}
