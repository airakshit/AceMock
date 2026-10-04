"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Countdown timer for a live attempt.
 *
 * The deadline is derived from the attempt's creation time plus the test
 * duration, so a refreshed page (or an attempt resumed later) keeps the
 * correct remaining time instead of restarting the clock.
 *
 * Returns the remaining whole seconds (0 once expired) or `null` while the
 * timer is not active yet.
 */
export function useAttemptTimer(options: {
  startedAt: Date | string | null;
  durationSeconds: number;
  active: boolean;
  onExpire: () => void;
}): number | null {
  const { startedAt, durationSeconds, active, onExpire } = options;

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Always call the latest onExpire without re-arming the interval.
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  // Keep the callback fresh without making it a dependency of the timer.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!active || !startedAt) return;

    expiredRef.current = false;
    const deadline = new Date(startedAt).getTime() + durationSeconds * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [active, startedAt, durationSeconds]);

  return remainingSeconds;
}
