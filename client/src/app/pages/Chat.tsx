import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send, Phone, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { Ride } from '../types';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'driver';
  time: string;
}

export function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I've booked a seat for the trip to Boston tomorrow.",
      sender: 'me',
      time: '10:30 AM',
    },
    {
      id: '2',
      text: 'Hello! Great to have you. Looking forward to the trip!',
      sender: 'driver',
      time: '10:32 AM',
    },
    {
      id: '3',
      text: 'Can I bring a small suitcase?',
      sender: 'me',
      time: '10:33 AM',
    },
    {
      id: '4',
      text: 'Absolutely! No problem with luggage. See you tomorrow at 9 AM.',
      sender: 'driver',
      time: '10:35 AM',
    },
  ]);

  useEffect(() => {
    const loadRide = async () => {
      try {
        const response = await api.get<Ride>(`/api/rides/${id}`);
        setRide(response.data);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || 'Ride not found');
      }
    };

    if (id) {
      loadRide();
    }
  }, [id]);

  if (!ride) {
    return <div className="p-6">{error || 'Loading chat...'}</div>;
  }

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: message,
      sender: 'me',
      time: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };

    setMessages([...messages, newMessage]);
    setMessage('');
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
            src={ride.driver.avatar}
            alt={ride.driver.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <h2 className="text-base">{ride.driver.name}</h2>
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
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.sender === 'me'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender === 'me' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {msg.time}
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
            disabled={!message.trim()}
            className="p-3 bg-blue-600 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
