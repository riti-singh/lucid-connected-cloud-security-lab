import { createContext, useContext } from 'react';
import type { DashboardModel } from './useDashboard';
import type { HashState } from './lib/hash';

export interface AppContextValue {
  model: DashboardModel;
  route: HashState;
  navigate: (hash: string) => void;
  openTicket: (ticket: string | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}
