import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send, Phone, MoreVertical, User, Flag, Ban, Share2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type { Message, Payment, Ride, User as AppUser } from '../types';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { UnlockInteractionModal } from '../components/UnlockInteractionModal';
import { Button } from '../components/Button';
import { handleAvatarError, toAvatarUrl } from '../lib/avatar';

const getUserId = (value: { id?: string; _id?: string } | null | undefined) => value?.id || value?._id || '';

const getSenderId = (msg: Message) => msg.sender?._id || msg.senderId?._id || '';
const getMessageText = (msg: Message) => msg.text || msg.message || '';
const getMessageTime = (msg: Message) => msg.createdAt || msg.timestamp || new Date().toISOString();

export function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, syncAccessSummary } = useAuth();
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
  const [interactionUnlocked, setInteractionUnlocked] = useState(false);
  const [chatLimitReached, setChatLimitReached] = useState(false);
  const [freeMessagesRemaining, setFreeMessagesRemaining] = useState<number>(5);

  const passengerChatLocked = !interactionUnlocked && chatLimitReached;
  const isChatClosedByRide = ride?.status === 'completed' || ride?.status === 'cancelled';

  const receiverId = useMemo(() => {
    if (!ride || !user) {
      return null;
    }

    if (getUserId(ride.driver) !== getUserId(user)) {
      return getUserId(ride.driver);
    }

    return null;
  }, [ride, user]);

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
        const latestMeta = messageResponse.data
          .slice()
          .reverse()
          .find((msg: any) => msg?._meta)?.['_meta'] as any;

        if (latestMeta) {
          setFreeMessagesRemaining(Number(latestMeta.freeMessagesRemaining ?? 0));
          setChatLimitReached(Boolean(latestMeta.freeLimitReached));
        }
        await api.patch(`/api/messages/${id}/seen`);
      } catch (requestError: any) {
        const errorCode = requestError?.response?.data?.error;
        const apiMessage = requestError?.response?.data?.message || 'Ride not found';
        if (apiMessage === 'User blocked') {
          setIsConversationBlocked(true);
          setMessages([]);
        }
        if (errorCode === 'INSUFFICIENT_TOKENS') {
          setShowUnlockModal(true);
        }
        if (String(apiMessage).toLowerCase().includes('payment')) {
          setShowUnlockModal(true);
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
    if (!id) {
      return;
    }

    api
      .get<{ payments?: Payment[] } | Payment[]>(`/api/payments/my?rideId=${id}`)
      .then((response) => {
        const paymentRows = Array.isArray(response.data) ? response.data : response.data?.payments || [];
        const hasApproved = paymentRows.some(
          (payment) => payment.type === 'interaction_unlock' && payment.status === 'approved',
        );
        setInteractionUnlocked(hasApproved);
        if (hasApproved) {
          setChatLimitReached(false);
        }
      })
      .catch(() => setInteractionUnlocked(false));
  }, [id, showUnlockModal]);

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

    const handleChatClosed = (payload: { rideId?: string; message?: string }) => {
      if (!payload?.rideId || payload.rideId === id) {
        toast.error(payload?.message || 'This ride is completed. Chat is disabled.');
      }
    };

    const handleChatLocked = (payload: { rideId?: string; message?: string }) => {
      if (!payload?.rideId || payload.rideId === id) {
        toast.error(payload?.message || 'Payment approval is required before joining chat.');
        setShowUnlockModal(true);
      }
    };

    socket.on('receive_message', handleNewMessage);
    socket.on('new_message', handleNewMessage);
    socket.on('chat_blocked', handleBlocked);
    socket.on('chat_closed', handleChatClosed);
    socket.on('chat_locked', handleChatLocked);

    return () => {
      socket.off('receive_message', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('chat_blocked', handleBlocked);
      socket.off('chat_closed', handleChatClosed);
      socket.off('chat_locked', handleChatLocked);
    };
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading chat...</div>;
  }

  if (!ride) {
    return <div className="p-6">{error || 'Loading chat...'}</div>;
  }

  const isDriverOwner = getUserId(ride.driver) === getUserId(user);
  const chatDisplayName = isDriverOwner ? 'Ride Group' : receiverProfile?.name || ride.driver.name;
  const chatAvatarUrl = toAvatarUrl(isDriverOwner ? ride.driver.profilePhoto : receiverProfile?.profilePhoto || ride.driver.profilePhoto);

  const handleSend = async () => {
    if (isChatClosedByRide) {
      toast.error('This ride is completed. Chat is disabled.');
      return;
    }

    if (isConversationBlocked) {
      toast.error('User blocked');
      return;
    }

    if (passengerChatLocked) {
      setShowUnlockModal(true);
      return;
    }

    if (!interactionUnlocked && freeMessagesRemaining <= 0) {
      setChatLimitReached(true);
      setShowUnlockModal(true);
      toast.error('Free chat limit reached. Pay to unlock unlimited chat.');
      return;
    }

    if (!interactionUnlocked) {
      const phoneRegex = /(\+?\d[\d\s\-()]{7,}\d)/;
      const whatsappRegex = /(wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/)/i;
      if (phoneRegex.test(message) || whatsappRegex.test(message)) {
        toast.error('Phone numbers and WhatsApp links are blocked before payment unlock.');
        return;
      }
    }

    if (!message.trim()) return;

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
      text,
      isSeen: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    if (!interactionUnlocked) {
      setFreeMessagesRemaining((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await api.post<Message & { tokensLeft?: number; tokensSpent?: number }>('/api/messages', {
        rideId: id,
        text,
      });

      syncAccessSummary(response.data);
      setMessages((prev) => prev.map((item) => (item.clientMessageId === clientMessageId ? response.data : item)));
    } catch (requestError: any) {
      const apiMessage = requestError?.response?.data?.message || 'Could not send message';
      syncAccessSummary(requestError?.response?.data);
      if (!interactionUnlocked) {
        setFreeMessagesRemaining((prev) => Math.min(5, prev + 1));
      }
      if (apiMessage === 'User blocked') {
        setIsConversationBlocked(true);
        setMessages([]);
      } else {
        setMessages((prev) => prev.filter((item) => item.clientMessageId !== clientMessageId));
      }

      if (requestError?.response?.data?.requiresPayment && requestError?.response?.data?.redirectTo) {
        navigate(requestError.response.data.redirectTo, {
          state: {
            action: 'chat',
            tokenInfo: requestError?.response?.data?.tokenInfo,
          },
        });
      }

      if (String(apiMessage).toLowerCase().includes('free chat limit')) {
        setChatLimitReached(true);
        setShowUnlockModal(true);
      }

      setMessage(text);
      toast.error(apiMessage);
    }
  };

  const handleCall = () => {
    const phone = receiverProfile?.phone || ride.driver.phone;

    if (!phone) {
      toast.error('Phone number not available');
      return;
    }

    if (!interactionUnlocked) {
      toast.error('Unlock contact to view and call phone number');
      setShowUnlockModal(true);
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
    <div className="relative mx-auto flex h-screen max-w-[420px] flex-col overflow-x-hidden bg-gray-50">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-3 py-3 md:px-4 md:py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img
            src={chatAvatarUrl}
            alt={chatDisplayName}
            loading="lazy"
            onError={handleAvatarError}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base">{chatDisplayName}</h2>
              <VerifiedBadge isVerified={Boolean(receiverProfile?.isVerified ?? ride.driver.isVerified)} />
            </div>
            <p className="text-xs text-gray-600 truncate">{ride.fromCity} → {ride.toCity}</p>
            <p className="text-[11px] text-gray-500">
              {interactionUnlocked ? 'Contact unlocked' : 'Contact hidden until payment unlock'}
            </p>
          </div>
          {!isDriverOwner ? (
            <Button type="button" variant="secondary" onClick={handleCall} className="min-h-12 w-12 p-0" leftIcon={<Phone className="w-5 h-5 text-gray-600" />}>
              
            </Button>
          ) : null}
          <div className="relative">
            <button className="p-2" onClick={() => setIsMenuOpen((prev) => !prev)}>
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            {isMenuOpen ? (
              <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                <Button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/profile?user=${receiverId || ''}`);
                  }}
                  variant="secondary"
                  className="!justify-start !rounded-none !bg-transparent hover:!bg-gray-50 !shadow-none"
                  leftIcon={<User className="h-4 w-4" />}
                >
                  View Profile
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/ride/${id}`);
                  }}
                  variant="secondary"
                  className="!justify-start !rounded-none !bg-transparent hover:!bg-gray-50 !shadow-none"
                  leftIcon={<ArrowLeft className="h-4 w-4 rotate-180" />}
                >
                  View Ride Details
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowReportModal(true);
                  }}
                  variant="secondary"
                  className="!justify-start !rounded-none !bg-transparent hover:!bg-gray-50 !shadow-none"
                  leftIcon={<Flag className="h-4 w-4" />}
                >
                  Report User
                </Button>
                <Button
                  type="button"
                  onClick={handleBlockUser}
                  variant="danger"
                  className="!justify-start !rounded-none !bg-transparent !text-red-600 hover:!bg-red-50 !shadow-none"
                  leftIcon={<Ban className="h-4 w-4" />}
                >
                  Block User
                </Button>
                <Button
                  type="button"
                  onClick={handleShareRide}
                  variant="secondary"
                  className="!justify-start !rounded-none !bg-transparent hover:!bg-gray-50 !shadow-none"
                  leftIcon={<Share2 className="h-4 w-4" />}
                >
                  Share Ride
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-36 pt-3 md:px-4 md:pb-40 md:pt-4">
        {isConversationBlocked ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">User blocked</div>
        ) : null}

        {isChatClosedByRide ? (
          <div className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">Ride completed - chat closed</div>
        ) : null}

        {passengerChatLocked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Free chat limit reached. Unlock for unlimited messages and phone contact.
          </div>
        ) : null}

        {!interactionUnlocked ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Free messages left: {freeMessagesRemaining}
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
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 ${
                    getSenderId(msg) === getUserId(user)
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {getSenderId(msg) !== getUserId(user) ? (
                    <p className="mb-1 text-[11px] font-medium text-slate-500">{msg.sender?.name || msg.senderId?.name || 'User'}</p>
                  ) : null}
                  <p className="text-sm md:text-base">{getMessageText(msg)}</p>
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

      <div className="absolute inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-3 py-3 md:px-4 md:py-4">
        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Each chat costs 2 tokens.
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={isConversationBlocked || isChatClosedByRide}
            className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || passengerChatLocked || isConversationBlocked || isChatClosedByRide}
            variant="primary"
            className="min-h-12 w-12 rounded-2xl p-0"
            leftIcon={<Send className="w-5 h-5" />}
          >
            
          </Button>
        </div>

        {passengerChatLocked ? (
          <Button
            type="button"
            onClick={() => setShowUnlockModal(true)}
            variant="secondary"
            className="mt-2 min-h-12 w-full border border-blue-200 !bg-blue-50 !text-blue-700"
          >
            Pay & Unlock Unlimited Chat
          </Button>
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
              <Button
                type="button"
                onClick={() => setShowReportModal(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReportUser}
                variant="primary"
                className="flex-1"
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <UnlockInteractionModal
        open={showUnlockModal}
        rideId={id}
        onClose={() => setShowUnlockModal(false)}
        onSubmitted={() => {
          setInteractionUnlocked(false);
          setChatLimitReached(false);
        }}
      />
    </div>
  );
}
