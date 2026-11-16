import { useOutletContext } from 'react-router-dom';
import type { StaffData } from './useStaffData';

/** What every staff page gets from the layout: the live data plus shared actions. */
export interface StaffCtx extends StaffData {
  /** Asks for confirmation, then resets the demo. */
  confirmReset: () => void;
  /** Ticks every 15 s so "last seen" stays current. */
  now: number;
}

export const useStaff = () => useOutletContext<StaffCtx>();
