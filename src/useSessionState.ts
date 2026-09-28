import { useEffect, useState } from "react";

/**
 * `useState` that survives page reloads by mirroring the value into
 * sessionStorage. A stored value that fails `isValid` (e.g. a shape that no
 * longer exists) is ignored in favour of `initial`.
 */
export function useSessionState<T>(
  key: string,
  initial: T | (() => T),
  isValid: (value: unknown) => boolean = () => true,
) {
  const [value, setValue] = useState<T>(() => {
    const stored = read(key);
    if (stored !== undefined && isValid(stored)) return stored as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the setting just won't persist.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function read(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}
