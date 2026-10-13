import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Sparkles, User, Bot, Check, CheckCheck } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';

interface MessageThread {
  id: string;
  sender: string;
  role: string;
  avatar: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: { sender: 'them' | 'me'; text: string; time: string }[];
}

const INITIAL_THREADS: MessageThread[] = [
  {
    id: 'thread-1',
    sender: 'Dr. Sarah Chen',
    role: 'VP Tech @ Quantum Lab',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    preview: 'We are scaling up to 10 additional Neural Accelerator Pods next week...',
    time: '4m ago',
    unread: true,
    messages: [
      {
        sender: 'them',
        text: 'Hi Alex, our initial stress tests on the Neural Pod v3 cluster returned phenomenal throughput benchmarks (<1.2ms latency).',
        time: '10:42 AM',
      },
      {
        sender: 'me',
        text: 'That is fantastic to hear, Sarah! The latest firmware update specifically improved tensor pipelining on high concurrency.',
        time: '10:44 AM',
      },
      {
        sender: 'them',
        text: 'We are looking to scale up to 10 additional Neural Accelerator Pods next week. Could you ensure stock allocation at US-East DC?',
        time: '10:48 AM',
      },
    ],
  },
  {
    id: 'thread-2',
    sender: 'Marcus Vance',
    role: 'CISO @ Vanguard AI',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    preview: 'Our automated compliance audit passed with zero cryptographic findings.',
    time: '1h ago',
    unread: false,
    messages: [
      {
        sender: 'them',
        text: 'Alex, just letting you know our SOC2 Type II auditor gave full clearance to the Aetheris data pipeline.',
        time: 'Yesterday',
      },
      {
        sender: 'me',
        text: 'Excellent news Marcus! Thanks for confirming.',
        time: 'Yesterday',
      },
    ],
  },
];

export const MessagesPage: React.FC = () => {
  const { addToast } = useToast();
  const [threads, setThreads] = useState<MessageThread[]>(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string>('thread-1');
  const [inputMessage, setInputMessage] = useState('');

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            messages: [
              ...t.messages,
              { sender: 'me', text: inputMessage, time: 'Just now' },
            ],
          };
        }
        return t;
      })
    );

    setInputMessage('');
    addToast({
      title: 'Message Transmitted',
      message: 'Encrypted payload dispatched over low-latency channel.',
      type: 'success',
    });
  };

  const handleInsertAiSuggestion = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-16"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Encrypted Communications Center
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure in-app direct messaging with VIP enterprise executives & AI copilot assistance
            </p>
          </div>
        </div>
      </div>

      {/* Main Messenger Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[640px]">
        {/* Threads List Sidebar */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl p-4 flex flex-col overflow-hidden">
          <div className="text-xs font-mono text-slate-400 pb-3 border-b border-white/5 uppercase">
            Active Priority Channels ({threads.length})
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-600/20 border-cyan-500/40 text-white'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={thread.avatar}
                      alt={thread.sender}
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white truncate">
                          {thread.sender}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{thread.time}</span>
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono truncate">{thread.role}</div>
                      <p className="text-xs text-slate-400 truncate mt-1">{thread.preview}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Chat Conversation Panel */}
        <div className="lg:col-span-8 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl p-6 flex flex-col justify-between overflow-hidden">
          {/* Thread Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <img
                src={activeThread.avatar}
                alt={activeThread.sender}
                className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10"
              />
              <div>
                <h3 className="font-bold text-white text-sm">{activeThread.sender}</h3>
                <div className="text-xs text-slate-400 font-mono">{activeThread.role}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TLS 1.3 SECURE DISPATCH</span>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
            {activeThread.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'me'
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'bg-white/[0.05] border border-white/10 text-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                  {msg.time} {msg.sender === 'me' && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                </span>
              </div>
            ))}
          </div>

          {/* AI Copilot Suggestions & Input */}
          <div className="pt-3 border-t border-white/5 space-y-3">
            {/* AI Assistant Quick Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] font-mono text-violet-400 flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-3 h-3" /> AI Copilot:
              </span>
              {[
                'We have reserved 10 pods at US-East DC for immediate dispatch.',
                'Confirmed. The SLA includes 24/7 dedicated hardware engineering.',
                'Would you prefer delivery scheduled for Tuesday or Thursday?',
              ].map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleInsertAiSuggestion(sug)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-slate-300 whitespace-nowrap transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Reply to ${activeThread.sender}...`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 border border-white/20 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MessagesPage;
