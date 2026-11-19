import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { compute, type Computed } from '../lib/compute';
import { useNow } from '../lib/useNow';
import { loadState, saveState } from './persist';
import { reducer, type Action } from './reducer';
import type { AppState } from './types';

interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
  computed: Computed;
  now: Date;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: AppState;
}) {
  const [state, rawDispatch] = useReducer(reducer, initialState, (init) => init ?? loadState());
  const now = useNow(state.outage ? 15_000 : 60_000);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const dispatch = useCallback(
    (action: Action) => rawDispatch({ ...action, now: new Date().toISOString() }),
    [],
  );

  const computed = useMemo(() => compute(state, now), [state, now]);
  const value = useMemo(
    () => ({ state, dispatch, computed, now }),
    [state, dispatch, computed, now],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
