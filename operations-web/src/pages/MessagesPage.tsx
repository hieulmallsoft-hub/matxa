import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Search, RefreshCw, MessageSquare, Check } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { request } from '../api/client';

type Participant = { id: string; displayName?: string | null; avatarUrl?: string | null };
type ApiMessage = {
  id: string;
  senderId: string;
  type: string;
  text?: string | null;
  createdAt: string;
  mediaUrl?: string | null;
  address?: string | null;
  recalledAt?: string | null;
};
type Conversation = {
  id: string;
  bookingId?: string | null;
  participant?: Participant | null;
  lastMessage?: ApiMessage | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
};
const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '';
const messageText = (message?: ApiMessage | null) => {
  if (!message) return 'Chưa có tin nhắn';
  if (message.recalledAt) return 'Tin nhắn đã được thu hồi';
  return (
    message.text ||
    (message.type === 'IMAGE'
      ? 'Đã gửi hình ảnh'
      : message.type === 'LOCATION'
        ? message.address || 'Đã gửi vị trí'
        : 'Thông báo hệ thống')
  );
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
const QUICK_REPLIES = [
  'Dạ MATXXA xin chào! Anh/chị cần hỗ trợ nội dung gì ạ?',
  'Dạ anh/chị vui lòng chờ để bên em kiểm tra thông tin ạ.',
  'Dạ cảm ơn anh/chị đã liên hệ MATXXA!',
];
function Avatar({ participant }: { participant?: Participant | null }) {
  return participant?.avatarUrl ? (
    <img src={participant.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
  ) : (
    <span className="w-10 h-10 rounded-full bg-[#EAF5EC] text-[#2E7D4A] flex items-center justify-center font-bold shrink-0">
      {(participant?.displayName || 'KH').slice(0, 2).toUpperCase()}
    </span>
  );
}

export const MessagesPage: React.FC = () => {
  const { addToast } = useToast();
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [readError, setReadError] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<{ conversationId: string; items: ApiMessage[] }>({
    conversationId: '',
    items: [],
  });
  const activeId = useRef(activeThreadId);
  activeId.current = activeThreadId;
  const sendingRef = useRef(false);
  const sendVersion = useRef(0);
  const scrollArea = useRef<HTMLDivElement>(null);
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const messages = history.conversationId === activeThreadId ? history.items : [];

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let userId = '';
    setLoading(true);
    const load = async () => {
      try {
        if (!userId) {
          const user = await request<{ id: string; role: string }>('/auth/me', { signal: controller.signal });
          if (user.role !== 'ADMIN') throw new Error('Vui lòng đăng nhập tài khoản quản trị để sử dụng hộp thư.');
          userId = user.id;
        }
        const payload = await request<Conversation[] | { items: Conversation[] }>('/conversations', {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const rows = Array.isArray(payload) ? payload : payload.items;
        setCurrentUserId(userId);
        setThreads(rows);
        setActiveThreadId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ''));
        setListError('');
      } catch (error) {
        if (!controller.signal.aborted) setListError(errorText(error));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(load, 5000);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    setInputMessage('');
    setMessageError('');
    setReadError('');
    if (!activeThreadId || !currentUserId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let lastReadMessageId: string | undefined;
    setMessagesLoading(true);
    const load = async () => {
      const version = sendVersion.current;
      try {
        const response = await request<{ items: ApiMessage[] }>(
          `/conversations/${activeThreadId}/messages?page=1&limit=100`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted || version !== sendVersion.current || sendingRef.current) return;
        setHistory({ conversationId: activeThreadId, items: [...response.items].reverse() });
        setMessageError('');
        const latestIncoming = response.items.find((message) => message.senderId !== currentUserId);
        if (latestIncoming && latestIncoming.id !== lastReadMessageId) {
          try {
            await request(`/conversations/${activeThreadId}/read`, { method: 'PATCH', signal: controller.signal });
            if (controller.signal.aborted) return;
            lastReadMessageId = latestIncoming.id;
            setReadError('');
            setThreads((rows) => rows.map((row) => (row.id === activeThreadId ? { ...row, unreadCount: 0 } : row)));
          } catch (error) {
            if (!controller.signal.aborted) setReadError(`Chưa đánh dấu đã đọc: ${errorText(error)}`);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessageError(errorText(error));
      } finally {
        if (!controller.signal.aborted) {
          setMessagesLoading(false);
          timer = setTimeout(load, 3000);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [activeThreadId, currentUserId, refreshKey]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const area = scrollArea.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [activeThreadId, lastMessageId]);

  const handleSendMessage = async (quickReply?: string) => {
    const text = (quickReply ?? inputMessage).trim();
    const conversationId = activeThreadId;
    if (!text || !conversationId || !currentUserId || sendingRef.current) return;
    sendingRef.current = true;
    sendVersion.current++;
    setSending(true);
    try {
      const message = await request<ApiMessage>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'TEXT', text }),
      });
      if (activeId.current === conversationId) {
        setHistory((current) => ({
          conversationId,
          items: [
            ...(current.conversationId === conversationId
              ? current.items.filter((item) => item.id !== message.id)
              : []),
            message,
          ],
        }));
        if (!quickReply) setInputMessage((current) => (current.trim() === text ? '' : current));
        setMessageError('');
      }
      setThreads((rows) =>
        rows.map((row) =>
          row.id === conversationId ? { ...row, lastMessage: message, lastMessageAt: message.createdAt } : row,
        ),
      );
    } catch (error) {
      addToast({ title: 'Không gửi được tin nhắn', message: errorText(error), type: 'error' });
    } finally {
      sendingRef.current = false;
      sendVersion.current++;
      setSending(false);
    }
  };
  const query = search.trim().toLocaleLowerCase('vi-VN');
  const filteredThreads = threads.filter((thread) =>
    `${thread.participant?.displayName || ''} ${messageText(thread.lastMessage)} ${thread.bookingId || ''}`
      .toLocaleLowerCase('vi-VN')
      .includes(query),
  );
  const unreadCount = threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
  const canSend = Boolean(activeThread && currentUserId && !sending && !loading && !messagesLoading);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <PageHeader
        title="Tin nhắn CSKH"
        subtitle="Trao đổi với khách hàng và kỹ thuật viên trong hội thoại đặt lịch"
        badge={unreadCount ? `${unreadCount} tin chưa đọc` : undefined}
        badgeTone="blue"
        breadcrumbs={[{ label: 'MATXXA' }, { label: 'Tin nhắn CSKH' }]}
        actions={
          <button
            onClick={() => setRefreshKey((key) => key + 1)}
            className="flex items-center gap-2 text-xs text-[#2E7D4A]"
          >
            <RefreshCw className="w-4 h-4" /> Tải lại
          </button>
        }
      />
      {listError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          Không tải được hội thoại: {listError}. Kiểm tra đăng nhập rồi bấm Tải lại.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100dvh-280px)] lg:min-h-[420px]">
        <aside className="lg:col-span-4 min-w-0 bg-white rounded-2xl border border-[#E5EBE5] overflow-hidden flex flex-col max-h-80 lg:max-h-none">
          <div className="p-3.5 border-b border-[#E5EBE5] relative">
            <Search className="w-4 h-4 absolute left-6 top-6 text-[#94A399]" />
            <input
              aria-label="Tìm hội thoại"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, nội dung, mã đặt lịch..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5EF]">
            {loading && <p className="p-6 text-xs text-[#66756B]">Đang tải hội thoại...</p>}
            {!loading && !listError && filteredThreads.length === 0 && (
              <p className="p-6 text-xs text-[#66756B]">
                {search
                  ? 'Không tìm thấy hội thoại phù hợp.'
                  : 'Chưa có hội thoại. Hội thoại xuất hiện sau khi khách hoặc KTV mở chat từ đơn đã được gán KTV.'}
              </p>
            )}
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full p-3.5 text-left flex gap-3 border-l-4 ${thread.id === activeThreadId ? 'bg-[#EAF5EC]/60 border-[#2E7D4A]' : 'border-transparent hover:bg-[#F6F8F4]'}`}
              >
                <Avatar participant={thread.participant} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{thread.participant?.displayName || 'Khách hàng'}</p>
                  <p className="text-xs text-[#66756B] truncate mt-1">{messageText(thread.lastMessage)}</p>
                  <div className="flex justify-between gap-2 mt-1 text-[10px] text-[#94A399]">
                    <span>{formatTime(thread.lastMessageAt || thread.lastMessage?.createdAt)}</span>
                    {!!thread.unreadCount && <span className="text-[#2E7D4A] font-bold">{thread.unreadCount} mới</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className="lg:col-span-5 min-w-0 min-h-0 h-[560px] lg:h-auto bg-white rounded-2xl border border-[#E5EBE5] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#E5EBE5] flex items-center gap-3 shrink-0">
            <Avatar participant={activeThread?.participant} />
            <div>
              <h3 className="font-bold text-xs">{activeThread?.participant?.displayName || 'Chọn hội thoại'}</h3>
              <p className="text-[11px] text-[#66756B]">
                {activeThread ? 'Tự cập nhật tin nhắn mỗi 3 giây' : 'Chọn khách hàng ở danh sách bên trái'}
              </p>
            </div>
          </div>
          {messageError && (
            <p role="alert" className="p-3 text-xs text-red-700 bg-red-50">
              Không tải được tin nhắn: {messageError}
            </p>
          )}
          {readError && (
            <p role="status" className="px-3 py-2 text-xs text-amber-700">
              {readError}
            </p>
          )}
          <div
            ref={scrollArea}
            aria-live="polite"
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-[#FAFBF9]"
          >
            {messagesLoading && <p className="text-xs text-[#66756B]">Đang tải tin nhắn...</p>}
            {!messagesLoading && !messageError && !messages.length && (
              <div className="text-center text-[#66756B] py-10 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-3" />
                {activeThread ? 'Chưa có tin nhắn. Bạn có thể gửi lời chào.' : 'Chưa chọn hội thoại.'}
              </div>
            )}
            {messages.map((message) => {
              const isMe = message.senderId === currentUserId;
              if (message.type === 'SYSTEM')
                return (
                  <p key={message.id} className="text-center text-[11px] text-[#66756B] py-2">
                    {messageText(message)}
                  </p>
                );
              return (
                <div key={message.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${isMe ? 'bg-[#2E7D4A] text-white' : 'bg-white border border-[#E5EBE5] text-[#1C2B20]'}`}
                  >
                    {!message.recalledAt && message.type === 'IMAGE' && message.mediaUrl ? (
                      <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                        <img src={message.mediaUrl} alt="Ảnh trong hội thoại" className="max-h-60 rounded-lg" />
                      </a>
                    ) : (
                      messageText(message)
                    )}
                  </div>
                  <span className="flex items-center gap-1 mt-1 text-[10px] text-[#94A399]">
                    {formatTime(message.createdAt)}
                    {isMe && <Check className="w-3 h-3" />}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="p-2.5 border-t border-[#E5EBE5] flex gap-1.5 overflow-x-auto shrink-0">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                disabled={!canSend}
                onClick={() => void handleSendMessage(reply)}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-[#F6F8F4] text-[#66756B] border border-[#E5EBE5] whitespace-nowrap disabled:opacity-40"
              >
                {reply}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendMessage();
            }}
            className="p-3 border-t border-[#E5EBE5] flex items-center gap-2 shrink-0"
          >
            <input
              aria-label="Nội dung tin nhắn"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              maxLength={4000}
              disabled={!activeThread || !currentUserId}
              placeholder={activeThread ? 'Nhập nội dung phản hồi...' : 'Chọn hội thoại để gửi tin'}
              className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs"
            />
            <button
              type="submit"
              disabled={!canSend || !inputMessage.trim()}
              title={sending ? 'Đang gửi...' : 'Gửi tin nhắn'}
              className="p-2 rounded-xl bg-[#2E7D4A] text-white disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
        <aside className="lg:col-span-3 min-w-0 bg-white rounded-2xl border border-[#E5EBE5] p-5 space-y-4 overflow-y-auto text-xs">
          <div className="flex items-center gap-3">
            <Avatar participant={activeThread?.participant} />
            <strong>{activeThread?.participant?.displayName || 'Thông tin hội thoại'}</strong>
          </div>
          <div>
            <p className="text-[#66756B] mb-1">Mã đặt lịch</p>
            <p className="break-all">{activeThread?.bookingId || 'Chưa có thông tin'}</p>
          </div>
          <p className="text-[#66756B] leading-relaxed">
            Hội thoại đặt lịch có thể gồm khách hàng, kỹ thuật viên và quản trị viên hỗ trợ. Tin nhắn gửi tại đây được
            lưu vào hội thoại thật.
          </p>
        </aside>
      </div>
    </motion.div>
  );
};
export default MessagesPage;
