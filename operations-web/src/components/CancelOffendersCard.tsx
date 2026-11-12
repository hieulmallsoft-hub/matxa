import React, { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { request } from '../api/client';
import { Badge, Button, Card } from './ui/kit';

type Offender = {
  user: { id: string; displayName: string | null; role: string; status: string } | null;
  cancellations: number;
  lastCancelledAt: string;
};

/**
 * Customers and technicians who cancelled many bookings a technician had already taken (counted toward the
 * cancel limit) in the last 7 days. The system only locks them temporarily; closing the account is the admin's call.
 */
export function CancelOffendersCard({ onBlock }: { onBlock: (userId: string, name: string) => Promise<boolean> }) {
  const [items, setItems] = useState<Offender[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setItems(await request<Offender[]>('/admin/marketplace/cancel-offenders?days=7&minCancellations=3').catch(() => []));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!items.length) return null;

  return (
    <Card title="Hủy đơn nhiều (7 ngày gần nhất)" subtitle="Đã hủy từ 3 đơn đã có KTV nhận trở lên. Xem xét khóa tài khoản nếu có dấu hiệu gian lận.">
      <ul className="divide-y divide-surface-borderSubtle">
        {items.map((item) => {
          const user = item.user;
          if (!user) return null;
          const name = user.displayName || user.id;
          return (
            <li key={user.id} className="py-2.5 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-[180px]">
                <span className="block text-sm font-semibold">{name}</span>
                <span className="block text-xs text-content-secondary">
                  {user.role === 'TECHNICIAN' ? 'KTV' : 'Khách hàng'} · lần gần nhất {new Date(item.lastCancelledAt).toLocaleString('vi-VN')}
                </span>
              </span>
              <Badge tone="red">{item.cancellations} lần hủy</Badge>
              {user.status === 'BLOCKED' ? (
                <Badge tone="gray">Đã khóa</Badge>
              ) : (
                <Button
                  size="sm"
                  icon={<Lock className="w-4 h-4" />}
                  loading={busy === user.id}
                  onClick={async () => {
                    setBusy(user.id);
                    if (await onBlock(user.id, name)) await load();
                    setBusy(null);
                  }}
                >
                  Khóa tài khoản
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
