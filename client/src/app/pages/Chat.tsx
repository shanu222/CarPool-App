import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send, Phone, MoreVertical, User, Flag, Ban, Share2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type { Message, Ride, User as AppUser } from '../types';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { PaymentModal } from '../components/PaymentModal';

const getUserId = (value: { id?: string; _id?: string } | null | undefined) => value?.id || value?._id || '';

const getSenderId = (msg: Message) => msg.sender?._id || msg.senderId?._id || '';
const getReceiverId = (msg: Message) => msg.receiver?._id || msg.receiverId?._id || '';
const getMessageText = (msg: Message) => msg.text || msg.message || '';
const getMessageTime = (msg: Message) => msg.createdAt || msg.timestamp || new Date().toISOString();

const maskPhone = (phone?: string) => {
  if (!phone) {
    return '';
  }

  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `${trimmed.slice(0, 3)}****${trimmed.slice(-2)}`;
};

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [receiverProfile, setReceiverProfile] = useState<AppUser | null>(null);
  const [isConversationBlocked, setIsConversationBlocked] = useState(false);

  const passengerChatLocked = user?.role === 'passenger' && user?.canChat !== true;

  const receiverId = useMemo(() => {
    if (!ride || !user) {
      return null;
    }

    if (getUserId(ride.driver) !== getUserId(user)) {
      return getUserId(ride.driver);
    }

    const counterpart = messages.find((msg) => getSenderId(msg) !== getUserId(user) || getReceiverId(msg) !== getUserId(user));

    if (!counterpart) {
      return null;
    }

    return getSenderId(counterpart) === getUserId(user) ? getReceiverId(counterpart) : getSenderId(counterpart);
  }, [messages, ride, user]);

  useEffect(() => {
    const loadRide = async () => {
      try {
        setLoading(true);
        setIsConversationBlocked(false);

        const [rideResponse, messageResponse] = await Promise.all([
          api.get<Ride>(`/api/rides/${id}`),
          api.get<Message[]>(`/api/messages/${id}`),
        ]);
        setRide(rideResponse.data);
        setMessages(messageResponse.data);
        await api.patch(`/api/messages/${id}/seen`);
      } catch (requestError: any) {
        const apiMessage = requestError?.response?.data?.message || 'Ride not found';
        if (apiMessage === 'User blocked') {
          setIsConversationBlocked(true);
          setMessages([]);
        }
        setError(apiMessage);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadRide();
    }
  }, [id]);

  useEffect(() => {
    if (!receiverId) {
      return;
    }

    api
      .get<AppUser>(`/api/user/${receiverId}`)
      .then((response) => setReceiverProfile(response.data))
      .catch(() => setReceiverProfile(null));
  }, [receiverId]);

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
      const incomingRide = incoming.ride || incoming.rideId;
      if (incomingRide === id) {
        setMessages((prev) => {
          const withoutTemp = incoming.clientMessageId ? prev.filter((item) => item.clientMessageId !== incoming.clientMessageId) : prev;

          if (withoutTemp.some((item) => item._id === incoming._id)) {
            return withoutTemp;
          }

          return [...withoutTemp, incoming];
        });
      }
    };

    const handleBlocked = () => {
      setIsConversationBlocked(true);
      setMessages([]);
      toast.error('User blocked');
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('new_message', handleNewMessage);
    socket.on('chat_blocked', handleBlocked);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('chat_blocked', handleBlocked);
    };
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading chat...</div>;
  }

  if (!ride) {
    return <div className="p-6">{error || 'Loading chat...'}</div>;
  }

  const handleSend = async () => {
    if (isConversationBlocked) {
      toast.error('User blocked');
      return;
    }

    if (passengerChatLocked) {
      setShowUnlockModal(true);
      return;
    }

    if (!user?.canChat) {
      toast.error('Complete verification/payment to call');
      return;
    }

    if (!message.trim()) return;

    if (!receiverId) {
      toast.error('Receiver not available for this ride chat yet');
      return;
    }

    const text = message.trim();
    setMessage('');
    const clientMessageId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const optimisticMessage: Message = {
      _id: clientMessageId,
      clientMessageId,
      ride: id || '',
      sender: {
        _id: getUserId(user),
        name: user?.name || 'You',
        role: (user?.role as 'passenger' | 'driver') || 'passenger',
      },
      receiver: {
        _id: receiverId,
        name: receiverProfile?.name || ride.driver.name,
        role: (receiverProfile?.role as 'passenger' | 'driver') || 'driver',
      },
      text,
      isSeen: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const socket = getSocket();

    try {
      if (socket?.connected) {
        socket.emit('send_message', {
          rideId: id,
          receiverId,
          text,
          clientMessageId,
        });
      } else {
        const response = await api.post<Message>('/api/messages', {
          rideId: id,
          receiverId,
          text,
        });

        setMessages((prev) => prev.map((item) => (item.clientMessageId === clientMessageId ? response.data : item)));
      }
    } catch (requestError: any) {
      const apiMessage = requestError?.response?.data?.message || 'Could not send message';
      if (apiMessage === 'User blocked') {
        setIsConversationBlocked(true);
        setMessages([]);
      } else {
        setMessages((prev) => prev.filter((item) => item.clientMessageId !== clientMessageId));
      }
      setMessage(text);
      toast.error(apiMessage);
    }
  };

  const handleCall = () => {
    const phone = receiverProfile?.phone || ride.driver.phone;

    if (!user?.canChat || !user?.isVerified || receiverProfile?.isVerified === false) {
      toast.error('Complete verification/payment to call');
      return;
    }

    if (!phone) {
      toast.error('Phone number not available');
      return;
    }

    window.location.href = `tel:${phone}`;
  };

  const handleReportUser = async () => {
    if (!receiverId || !reportReason.trim()) {
      toast.error('Please add report reason');
      return;
    }

    try {
      await api.post('/api/user/report', {
        targetUserId: receiverId,
        rideId: id,
        reason: reportReason.trim(),
      });
      setShowReportModal(false);
      setReportReason('');
      setIsMenuOpen(false);
      toast.success('User reported');
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.message || 'Could not report user');
    }
  };

  const handleBlockUser = async () => {
    if (!receiverId) {
      toast.error('User not available');
      return;
    }

    if (!window.confirm('Block this user?')) {
      return;
    }

    try {
      await api.post('/api/user/block', { targetUserId: receiverId });
      setIsConversationBlocked(true);
      setMessages([]);
      setIsMenuOpen(false);
      toast.success('User blocked');
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.message || 'Could not block user');
    }
  };

  const handleShareRide = async () => {
    const link = `${window.location.origin}/ride/${id}`;

    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ride link copied');
    } catch {
      toast.error('Could not copy ride link');
    }

    setIsMenuOpen(false);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(receiverProfile?.name || ride.driver.name)}`}
            alt={receiverProfile?.name || ride.driver.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base">{receiverProfile?.name || ride.driver.name}</h2>
              <VerifiedBadge isVerified={Boolean(receiverProfile?.isVerified ?? ride.driver.isVerified)} />
            </div>
            <p className="text-xs text-gray-600">{ride.fromCity} → {ride.toCity}</p>
            {(receiverProfile?.phone || ride.driver.phone) ? (
              <p className="text-[11px] text-gray-500">{maskPhone(receiverProfile?.phone || ride.driver.phone)}</p>
            ) : null}
          </div>
          <button className="p-2" onClick={handleCall}>
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <div className="relative">
            <button className="p-2" onClick={() => setIsMenuOpen((prev) => !prev)}>
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            {isMenuOpen ? (
              <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/profile?user=${receiverId || ''}`);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <User className="h-4 w-4" />
                  View Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/ride/${id}`);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                  View Ride Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Flag className="h-4 w-4" />
                  Report User
                </button>
                <button
                  type="button"
                  onClick={handleBlockUser}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Ban className="h-4 w-4" />
                  Block User
                </button>
                <button
                  type="button"
                  onClick={handleShareRide}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Share2 className="h-4 w-4" />
                  Share Ride
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {isConversationBlocked ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">User blocked</div>
        ) : null}

        {passengerChatLocked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Payment approval is required before passenger chat.
          </div>
        ) : null}

        {!isConversationBlocked
          ? messages.map((msg) => (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${getSenderId(msg) === getUserId(user) ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    getSenderId(msg) === getUserId(user)
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                  }`}
                >
                  <p className="text-sm">{getMessageText(msg)}</p>
                  <p
                    className={`text-xs mt-1 ${
                      getSenderId(msg) === getUserId(user) ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(getMessageTime(msg)).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            ))
          : null}
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={isConversationBlocked}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || passengerChatLocked || !user?.canChat || isConversationBlocked}
            className="p-3 bg-blue-600 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {passengerChatLocked ? (
          <button
            type="button"
            onClick={() => setShowUnlockModal(true)}
            className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm text-blue-700"
          >
            Submit payment proof to unlock chat
          </button>
        ) : null}
      </div>

      {showReportModal ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Report User</h3>
              <button type="button" onClick={() => setShowReportModal(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Enter report reason"
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportUser}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PaymentModal
        open={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        paymentType="booking_unlock"
      />
    </div>
  );
}
