import { createContext, useContext, type ReactNode } from 'react';

/** An incoming message, shown as a notification banner at the top of the screen (like a phone notification). */
export interface Notice {
  title: string;
  body?: string;
  icon?: ReactNode;
  /** Runs when the banner is tapped. */
  onOpen?: () => void;
}

export const ToastCtx = createContext<(msg: string | Notice) => void>(() => {});

/** Show a short confirmation toast (a string) or a notification banner (a `Notice`). */
export const useToast = () => useContext(ToastCtx);
