import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send, Phone, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type { Message, Ride } from '../types';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { UnlockInteractionModal } from '../components/UnlockInteractionModal';

const getUserId = (value: { id?: string; _id?: string } | null | undefined) =>
  value?.id || value?._id || '';

export function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const receiverId = useMemo(() => {
    if (!ride || !user) {
      return null;
    }

    if (getUserId(ride.driver) !== getUserId(user)) {
      return getUserId(ride.driver);
    }

    const counterpart = messages.find(
      (msg) => msg.sender._id !== getUserId(user) || msg.receiver._id !== getUserId(user)
    );

    if (!counterpart) {
      return null;
    }

    return counterpart.sender._id === getUserId(user) ? counterpart.receiver._id : counterpart.sender._id;
  }, [messages, ride, user]);

  useEffect(() => {
    const loadRide = async () => {
      try {
        setLoading(true);
        const [rideResponse, messageResponse] = await Promise.all([
          api.get<Ride>(`/api/rides/${id}`),
          api.get<Message[]>(`/api/messages/ride/${id}`),
        ]);
        setRide(rideResponse.data);
        setMessages(messageResponse.data);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Ride not found');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadRide();
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const socket = getSocket();

    if (!socket) {
      return;
    }

    socket.emit('join_ride_room', { rideId: id });

    const handleNewMessage = (incoming: Message) => {
      if (incoming.ride === id) {
        setMessages((prev) => {
          if (prev.some((item) => item._id === incoming._id)) {
            return prev;
          }

          return [...prev, incoming];
        });
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading chat...</div>;
  }

  if (!ride) {
    return <div className="p-6">{error || 'Loading chat...'}</div>;
  }

  const handleSend = async () => {
    if (!user?.canChat) {
      setShowUnlockModal(true);
      return;
    }

    if (!message.trim()) return;

    if (!receiverId) {
      toast.error('Receiver not available for this ride chat yet');
      return;
    }

    const text = message.trim();
    setMessage('');

    try {
      await api.post('/api/messages', {
        rideId: id,
        receiverId,
        text,
      });
    } catch (requestError: any) {
      setMessage(text);
      toast.error(requestError?.response?.data?.message || 'Could not send message');
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(ride.driver.name)}`}
            alt={ride.driver.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base">{ride.driver.name}</h2>
              <VerifiedBadge isVerified={ride.driver.isVerified} />
            </div>
            <p className="text-xs text-gray-600">
              {ride.fromCity} → {ride.toCity}
            </p>
          </div>
          <button className="p-2">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!user?.canChat ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Pay to unlock interaction before opening chat.
          </div>
        ) : null}

        {messages.map((msg) => (
          <motion.div
            key={msg._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender._id === getUserId(user) ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.sender._id === getUserId(user)
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender._id === getUserId(user) ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || !user?.canChat}
            className="p-3 bg-blue-600 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {!user?.canChat ? (
          <button
            type="button"
            onClick={() => setShowUnlockModal(true)}
            className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm text-blue-700"
          >
            Pay to unlock interaction
          </button>
        ) : null}
      </div>

      <UnlockInteractionModal open={showUnlockModal} onClose={() => setShowUnlockModal(false)} />
    </div>
  );
}
