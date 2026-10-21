import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Sparkles,
  User,
  Phone,
  Clock,
  Check,
  CheckCheck,
  Search,
  MapPin,
  CalendarDays,
  Tag,
  Paperclip,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';

interface MessageThread {
  id: string;
  sender: string;
  phone: string;
  tier: string;
  avatar: string;
  preview: string;
  time: string;
  unread: boolean;
  address: string;
  recentBooking: string;
  messages: { sender: 'them' | 'me'; text: string; time: string }[];
}

const INITIAL_THREADS: MessageThread[] = [
  {
    id: 'thread-1',
    sender: 'Nguyễn Thị Lan Anh',
    phone: '0901 888 234',
    tier: 'VIP Platinum',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
    preview: 'Kỹ thuật viên Mai Anh đã chuẩn bị tới nơi chưa em?',
    time: '4 phút trước',
    unread: true,
    address: 'Quận 1, TP. Hồ Chí Minh',
    recentBooking: 'Massage Cổ Vai Gáy 90p lúc 10:00',
    messages: [
      {
        sender: 'them',
        text: 'Chào admin, chị đã đặt lịch trị liệu cổ vai gáy 90 phút lúc 10h sáng nay tại Quận 1.',
        time: '09:40',
      },
      {
        sender: 'me',
        text: 'Dạ MATXXA xin chào chị Lan Anh ạ! Ca đặt #BK-1048 của chị đã được phân công cho KTV Mai Anh.',
        time: '09:42',
      },
      {
        sender: 'them',
        text: 'Kỹ thuật viên Mai Anh đã chuẩn bị tới nơi chưa em? Chị cần chuẩn bị không gian gì trước không?',
        time: '09:48',
      },
    ],
  },
  {
    id: 'thread-2',
    sender: 'Trần Minh Hoàng',
    phone: '0903 555 888',
    tier: 'Gold Member',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    preview: 'Cho mình hỏi gói Shiatsu bên bạn có massage chân không?',
    time: '25 phút trước',
    unread: false,
    address: 'Quận 3, TP. Hồ Chí Minh',
    recentBooking: 'Shiatsu Nhật Bản 60p',
    messages: [
      {
        sender: 'them',
        text: 'Cho mình hỏi liệu trình Shiatsu Nhật Bản có bao gồm bấm huyệt chân và vai không shop?',
        time: '08:30',
      },
      {
        sender: 'me',
        text: 'Dạ liệu trình Shiatsu 60 phút sẽ tập trung kinh lạc toàn thân kết hợp bấm huyệt chân thảo dược anh Hoàng nhé!',
        time: '08:35',
      },
      {
        sender: 'them',
        text: 'Ok cảm ơn shop, để mình đặt ca chiều nay.',
        time: '08:38',
      },
    ],
  },
  {
    id: 'thread-3',
    sender: 'Lê Thu Hà',
    phone: '0912 666 777',
    tier: 'VIP Platinum',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    preview: 'Dịch vụ của KTV Hương hôm qua rất tuyệt vời em nhé!',
    time: '1 giờ trước',
    unread: false,
    address: 'Cầu Giấy, Hà Nội',
    recentBooking: 'Combo VIP 120p',
    messages: [
      {
        sender: 'them',
        text: 'Dịch vụ của bạn KTV Hương hôm qua rất tuyệt vời em nhé, chị đã chấm 5 sao trên ứng dụng rồi.',
        time: 'Hôm qua',
      },
      {
        sender: 'me',
        text: 'Dạ MATXXA chân thành cảm ơn chị Thu Hà! Chúc chị một ngày mới nhiều năng lượng và thư thái ạ.',
        time: 'Hôm qua',
      },
    ],
  },
];

const QUICK_REPLIES = [
  'Dạ KTV đang di chuyển và sẽ có mặt trước giờ hẹn 10 phút ạ!',
  'Dạ anh/chị cần hỗ trợ thêm thông tin về gói dịch vụ nào ạ?',
  'Dạ MATXXA đã ghi nhận yêu cầu và cập nhật cho kỹ thuật viên rồi ạ.',
  'Dạ voucher ưu đãi 20% đã được áp dụng trực tiếp vào đơn của mình ạ.',
];

export const MessagesPage: React.FC = () => {
  const { addToast } = useToast();
  const [threads, setThreads] = useState<MessageThread[]>(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string>('thread-1');
  const [inputMessage, setInputMessage] = useState('');
  const [search, setSearch] = useState('');

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            preview: `Bạn: ${text}`,
            time: 'Vừa xong',
            unread: false,
            messages: [
              ...t.messages,
              {
                sender: 'me',
                text,
                time: timeNow,
              },
            ],
          };
        }
        return t;
      })
    );

    setInputMessage('');
    addToast({
      title: 'Đã gửi phản hồi',
      message: 'Tin nhắn đã được gửi đến khách hàng.',
      type: 'success',
    });
  };

  const filteredThreads = threads.filter(
    (t) =>
      t.sender.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search) ||
      t.preview.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* Page Header */}
      <PageHeader
        title="Tin nhắn CSKH"
        subtitle="Hộp thư hỗ trợ trực tuyến, tư vấn đặt lịch và giải đáp thắc mắc khách hàng"
        badge="1 tin nhắn mới"
        badgeTone="blue"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Tin nhắn CSKH' },
        ]}
      />

      {/* 3-Column Modern Inbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-220px)] min-h-[600px] max-h-[750px]">
        {/* CỘT 1: Danh sách hội thoại (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] overflow-hidden flex flex-col h-full">
          {/* Search box */}
          <div className="p-3.5 border-b border-[#E5EBE5]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A399] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện, SĐT..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A]"
              />
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5EF]">
            {filteredThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setThreads((prev) =>
                      prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t))
                    );
                  }}
                  className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                    isActive ? 'bg-[#EAF5EC]/60 border-l-4 border-l-[#2E7D4A]' : 'hover:bg-[#F6F8F4]'
                  }`}
                >
                  <img
                    src={thread.avatar}
                    alt={thread.sender}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-[#E5EBE5] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#1C2B20] truncate">
                        {thread.sender}
                      </span>
                      <span className="text-[10px] text-[#94A399] flex-shrink-0 font-mono">
                        {thread.time}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 truncate ${thread.unread ? 'font-bold text-[#1C2B20]' : 'text-[#66756B]'}`}>
                      {thread.preview}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#F1F5EF] text-[#66756B] font-semibold">
                        {thread.tier}
                      </span>
                      {thread.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#2E7D4A] ml-auto" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CỘT 2: Nội dung chat & Chat input (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] overflow-hidden flex flex-col h-full">
          {/* Chat Header */}
          <div className="px-5 py-3.5 border-b border-[#E5EBE5] flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <img
                src={activeThread.avatar}
                alt={activeThread.sender}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E5EBE5]"
              />
              <div>
                <h3 className="font-bold text-xs text-[#1C2B20]">{activeThread.sender}</h3>
                <span className="text-[11px] text-[#2E9B62] flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E9B62]" /> Đang trực tuyến
                </span>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF5EC] text-[#2E7D4A]">
              {activeThread.tier}
            </span>
          </div>

          {/* Messages Bubble Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAFBF9]">
            {activeThread.messages.map((msg, idx) => {
              const isMe = msg.sender === 'me';
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-[#2E7D4A] text-white rounded-tr-none'
                        : 'bg-white text-[#1C2B20] border border-[#E5EBE5] rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[#94A399]">
                    <span>{msg.time}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-[#2E7D4A]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick reply templates */}
          <div className="p-2.5 bg-white border-t border-[#E5EBE5] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_REPLIES.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(reply)}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-[#F6F8F4] hover:bg-[#EAF5EC] text-[#66756B] hover:text-[#2E7D4A] border border-[#E5EBE5] whitespace-nowrap transition-colors cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Message input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-[#E5EBE5] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Nhập nội dung phản hồi khách hàng..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A]"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
              title="Gửi tin nhắn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* CỘT 3: Thông tin nhanh khách hàng (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] p-5 space-y-4 overflow-y-auto h-full text-xs">
          <div className="text-center pb-4 border-b border-[#E5EBE5]">
            <img
              src={activeThread.avatar}
              alt={activeThread.sender}
              className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-[#EAF5EC] mb-2"
            />
            <h4 className="font-bold text-sm text-[#1C2B20]">{activeThread.sender}</h4>
            <span className="text-[11px] text-[#66756B] block mt-0.5">{activeThread.phone}</span>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF6E9] text-[#B87A14] border border-[#FBE3B8]">
              {activeThread.tier}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-bold text-[#66756B] uppercase block mb-1">
                Địa chỉ phục vụ
              </span>
              <p className="text-[#1C2B20] font-medium leading-relaxed">
                {activeThread.address}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-[#66756B] uppercase block mb-1">
                Lịch đặt gần nhất
              </span>
              <div className="p-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
                <strong className="text-[#2E7D4A] block">{activeThread.recentBooking}</strong>
                <span className="text-[10px] text-[#66756B]">KTV: Mai Anh (5.0★)</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-[#66756B] uppercase block mb-1">
                Ghi chú CSKH
              </span>
              <p className="text-[#66756B] text-[11px] leading-relaxed">
                Khách thích lực vừa phải, tập trung cơ vai gáy, thường yêu cầu kỹ thuật viên mang theo tinh dầu oải hương.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MessagesPage;
