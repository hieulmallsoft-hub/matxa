import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, MapPin, Send, Star, Wallet } from 'lucide-react';
import { request } from '../api/client';
import { DetailDrawer } from './common/DetailDrawer';
import { useToast } from './ui/ToastContainer';
import { Badge, Button, Spinner } from './ui/kit';

type Context = {
  id: string;
  status: string;
  statusLabel: string;
  reasonLabel: string;
  detail: string;
  contactEmail: string;
  createdAt: string;
  evidenceCount: number;
  conversationId: string;
  customer?: { id: string; displayName?: string | null } | null;
  booking: {
    code: string;
    status: string;
    scheduledStart: string;
    addressText: string | null;
    paymentMethod: string;
    totalAmount: number;
    items: Array<{ name: string; durationMinutes: number; price: number }>;
  };
  technician: { displayName: string | null; avatarUrl: string | null; averageRating: number; reviewCount: number } | null;
};
type Message = {
  id: string;
  senderId: string;
  type: string;
  text?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  recalledAt?: string | null;
  sender?: { role?: string; displayName?: string | null };
};

const STATUS_TONE: Record<string, 'blue' | 'amber' | 'green' | 'red'> = {
  SUBMITTED: 'blue',
  IN_REVIEW: 'amber',
  RESOLVED: 'green',
  REJECTED: 'red',
};
const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const time = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/** "Hỗ trợ đơn hàng": the admin side of one complaint's chat, with the booking and technician on top. */
export function ComplaintChatDrawer({ complaintId, onClose }: { complaintId: string | null; onClose: () => void }) {
  const { addToast } = useToast();
  const [context, setContext] = useState<Context | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    const page = await request<{ items: Message[] }>(`/conversations/${conversationId}/messages?page=1&limit=100`);
    setMessages([...page.items].reverse());
    void request(`/conversations/${conversationId}/read`, { method: 'PATCH' }).catch(() => undefined);
  }, []);

  useEffect(() => {
    setContext(null);
    setMessages([]);
    if (!complaintId) return;
    let stopped = false;
    void request<Context>(`/admin/complaints/${complaintId}`)
      .then(async (value) => {
        if (stopped) return;
        setContext(value);
        await loadMessages(value.conversationId);
      })
      .catch((error) => addToast({ type: 'error', title: 'Không mở được chat', message: error instanceof Error ? error.message : undefined }));
    return () => {
      stopped = true;
    };
  }, [complaintId, loadMessages, addToast]);

  // Customer replies show up without reopening the drawer.
  useEffect(() => {
    if (!context) return;
    const timer = setInterval(() => void loadMessages(context.conversationId).catch(() => undefined), 5000);
    return () => clearInterval(timer);
  }, [context, loadMessages]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !context) return;
    setSending(true);
    try {
      await request(`/conversations/${context.conversationId}/messages`, { method: 'POST', body: JSON.stringify({ type: 'TEXT', text }) });
      setDraft('');
      await loadMessages(context.conversationId);
    } catch (error) {
      addToast({ type: 'error', title: 'Không gửi được tin nhắn', message: error instanceof Error ? error.message : undefined });
    } finally {
      setSending(false);
    }
  };

  return (
    <DetailDrawer
      isOpen={Boolean(complaintId)}
      onClose={onClose}
      width="xl"
      title={context ? `Hỗ trợ đơn #${context.booking.code}` : 'Hỗ trợ đơn hàng'}
      subtitle={context ? `${context.customer?.displayName || 'Khách hàng'} · ${context.contactEmail}` : undefined}
      badge={context && <Badge tone={STATUS_TONE[context.status] ?? 'gray'} dot>{context.statusLabel}</Badge>}
      footer={
        <form onSubmit={send} className="flex w-full gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập tin nhắn gửi khách…"
            disabled={!context}
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white border border-surface-border text-sm focus:outline-none focus:border-primary"
          />
          <Button type="submit" variant="primary" loading={sending} disabled={!draft.trim() || !context} icon={<Send className="w-4 h-4" />}>
            Gửi
          </Button>
        </form>
      }
    >
      {!context ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-6 h-6" />
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-surface-border overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-surface-subtle">
              {context.technician?.avatarUrl ? (
                <img src={context.technician.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3C9A5E] to-primary text-white font-bold flex items-center justify-center">
                  {(context.technician?.displayName || 'K').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[11px] text-content-tertiary">KTV được đặt</div>
                <div className="font-semibold">{context.technician?.displayName ?? 'Chưa có KTV'}</div>
                {context.technician && (
                  <div className="flex items-center gap-1 text-xs text-content-secondary">
                    <Star className="w-3.5 h-3.5 fill-[#F5B400] text-[#F5B400]" />
                    {context.technician.averageRating.toFixed(1)} ({context.technician.reviewCount} đánh giá)
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 space-y-2 text-xs text-content-secondary">
              {context.booking.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm text-content-primary">
                  <span>{item.name}</span>
                  <span className="text-content-secondary">{item.durationMinutes} phút</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <CalendarClock className="w-3.5 h-3.5" /> {time(context.booking.scheduledStart)}
              </div>
              {context.booking.addressText && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {context.booking.addressText}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> {money(context.booking.totalAmount)} ·{' '}
                {context.booking.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#F8D2D0] bg-[#FDF3F2] p-4">
            <div className="text-xs font-semibold text-[#B9403A]">Khiếu nại · {context.reasonLabel}</div>
            <p className="mt-1.5 text-sm text-content-primary whitespace-pre-line">{context.detail}</p>
            <div className="mt-2 text-[11px] text-content-tertiary">
              Gửi lúc {time(context.createdAt)} · {context.evidenceCount} ảnh minh chứng
            </div>
          </section>

          <section className="space-y-2.5">
            {messages.map((message) => {
              if (message.type === 'SYSTEM')
                return (
                  <div key={message.id} className="text-center">
                    <span className="inline-block px-3 py-1 rounded-full bg-surface-subtle text-[11px] text-content-secondary">
                      {message.text}
                    </span>
                  </div>
                );
              const mine = message.sender?.role === 'ADMIN';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-primary text-white rounded-br-md' : 'bg-surface-subtle text-content-primary rounded-bl-md'
                    }`}
                  >
                    {message.recalledAt ? (
                      <i className="opacity-70">Tin nhắn đã được thu hồi</i>
                    ) : message.type === 'IMAGE' && message.mediaUrl ? (
                      <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                        <img src={message.mediaUrl} alt="Ảnh khách gửi" className="rounded-lg max-h-56" />
                      </a>
                    ) : (
                      <span className="whitespace-pre-line">{message.text}</span>
                    )}
                    <div className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-content-tertiary'}`}>{time(message.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </section>
        </>
      )}
    </DetailDrawer>
  );
}

export default ComplaintChatDrawer;
