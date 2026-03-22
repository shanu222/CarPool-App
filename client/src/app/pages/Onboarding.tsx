import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Car, Users, Shield, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const slides = [
  {
    icon: Car,
    title: 'Affordable Intercity Travel',
    description: 'Share rides between cities and split costs with fellow travelers. Save money while making new connections.',
    color: 'bg-blue-500',
  },
  {
    icon: Users,
    title: 'How It Works',
    description: 'Drivers post planned trips with available seats. Passengers book and share the journey. Everyone saves!',
    color: 'bg-green-500',
  },
  {
    icon: Shield,
    title: 'Safe & Verified',
    description: 'All users are verified with ratings and reviews. Travel with confidence and peace of mind.',
    color: 'bg-purple-500',
  },
];

export function Onboarding() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate('/auth');
    }
  };

  const handleSkip = () => {
    navigate('/auth');
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="glass-subtle rounded-xl px-4 py-2 text-slate-100 transition-all duration-200 hover:bg-white/20"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <div className={`glass-panel rounded-3xl p-8 mb-8 ${slide.color}`}>
              <Icon className="w-20 h-20 text-white" />
            </div>

            {/* Title */}
            <h1 className="text-3xl mb-4 text-white">{slide.title}</h1>

            {/* Description */}
            <p className="text-slate-100 text-lg leading-relaxed max-w-sm">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Section */}
      <div className="px-8 pb-12">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? 'w-8 bg-white'
                  : 'w-2 bg-white/45'
              }`}
            />
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full glass-panel text-white py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 hover:bg-white/25"
        >
          <span>{currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
