import { createContext, useContext } from 'react';

export const ToastCtx = createContext<(msg: string) => void>(() => {});

/** Show a short confirmation toast. */
export const useToast = () => useContext(ToastCtx);
