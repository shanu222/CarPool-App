import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { ConversationListItem, Message } from '../types';
import { getSocket } from '../lib/socket';
import { handleAvatarError, toAvatarUrl } from '../lib/avatar';

const asDate = (value?: string) => {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMessageTime = (value?: string) => {
  const parsed = asDate(value);
  if (!parsed) {
    return '';
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const sortConversations = (rows: ConversationListItem[]) => {
  return [...rows].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    const leftTime = asDate(left.lastMessageAt)?.getTime() || 0;
    const rightTime = asDate(right.lastMessageAt)?.getTime() || 0;
    return rightTime - leftTime;
  });
};

export function Messages() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get<ConversationListItem[]>('/api/messages/conversations');
        setConversations(sortConversations(response.data || []));
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Could not load conversations');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const onNewMessage = (payload: Message) => {
      const rideId = String(payload.ride || payload.rideId || '').trim();
      if (!rideId) {
        return;
      }

      const text = String(payload.text || payload.message || '').trim();
      const timestamp = payload.createdAt || payload.timestamp || new Date().toISOString();

      setConversations((prev) => {
        const existing = prev.find((item) => item.rideId === rideId);
        if (!existing) {
          return prev;
        }

        const next = prev.map((item) =>
          item.rideId === rideId
            ? {
                ...item,
                lastMessage: text || item.lastMessage,
                lastMessageAt: timestamp,
                hasMessages: true,
              }
            : item
        );

        return sortConversations(next);
      });
    };

    socket.on('new_message', onNewMessage);
    socket.on('receive_message', onNewMessage);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('receive_message', onNewMessage);
    };
  }, []);

  const activeCount = useMemo(() => conversations.filter((item) => item.isActive).length, [conversations]);

  return (
    <div className="relative min-h-screen bg-transparent pb-28">
      <div className="glass-panel mx-4 mt-4 rounded-3xl px-6 py-4 sticky top-2 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="-ml-2 p-2 text-white/90">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl text-white">Messages</h1>
            <p className="text-xs text-slate-200">{activeCount} active chats</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {loading ? <div className="px-2 text-sm text-slate-100">Loading conversations...</div> : null}
        {error ? <div className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</div> : null}

        {!loading && !error && conversations.length === 0 ? (
          <div className="glass-panel rounded-2xl px-4 py-8 text-center">
            <p className="text-base text-white">No conversations yet</p>
          </div>
        ) : null}

        {!loading && !error
          ? conversations.map((item) => (
              <motion.button
                type="button"
                key={item.rideId}
                onClick={() => navigate(`/chat/${item.rideId}`)}
                whileTap={{ scale: 0.98 }}
                className="glass-panel w-full rounded-2xl px-4 py-3 text-left"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={toAvatarUrl(item.counterpart?.profilePhoto)}
                    alt={item.counterpart?.name || 'User'}
                    loading="lazy"
                    onError={handleAvatarError}
                    className="h-12 w-12 rounded-full border border-white/70 object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {item.counterpart?.name || 'Ride Chat'}
                      </p>
                      <span className="text-[11px] text-slate-200">{formatMessageTime(item.lastMessageAt)}</span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-200">{item.lastMessage || 'No messages yet'}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-300">{item.route}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <MessageCircle className="h-4 w-4 text-slate-200" />
                    {item.isActive ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
                        {String(item.rideStatus || '').replace(/^[a-z]/, (c) => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))
          : null}
      </div>
    </div>
  );
}
