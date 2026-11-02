import { useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';
import type { CountKey } from '../navigation';

type Counts = Record<CountKey, number> & { healthy: boolean | null };
type Paged = { total?: number };

const EMPTY: Counts = { pendingBookings: 0, pendingApplications: 0, unreadSupport: 0, unreadNotifications: 0, healthy: null };
const REFRESH_MS = 60_000;

/** Real work-queue numbers for menu badges and the top bar; a failed source counts as 0. */
export function useAdminCounts(enabled: boolean) {
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const refresh = useCallback(async () => {
    const [bookings, applications, support, notifications, health] = await Promise.allSettled([
      request<Paged>('/admin/marketplace/bookings?status=PENDING&limit=1'),
      request<Paged>('/admin/marketplace/technician-applications?status=SUBMITTED&limit=1'),
      request<Array<{ unreadCount?: number }>>('/conversations?type=SUPPORT'),
      request<{ unreadCount?: number }>('/notifications?unreadOnly=true&limit=1'),
      request('/health'),
    ]);
    setCounts({
      pendingBookings: bookings.status === 'fulfilled' ? (bookings.value?.total ?? 0) : 0,
      pendingApplications: applications.status === 'fulfilled' ? (applications.value?.total ?? 0) : 0,
      unreadSupport:
        support.status === 'fulfilled'
          ? (support.value ?? []).reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0)
          : 0,
      unreadNotifications: notifications.status === 'fulfilled' ? (notifications.value?.unreadCount ?? 0) : 0,
      healthy: health.status === 'fulfilled',
    });
  }, []);
  useEffect(() => {
    if (!enabled) return setCounts(EMPTY);
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);
  return { counts, refresh };
}
