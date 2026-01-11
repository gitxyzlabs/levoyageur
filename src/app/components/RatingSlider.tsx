import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface RatingSliderProps {
  value: number; // 0-100 with decimals
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RatingSlider({ value, onChange, disabled = false }: RatingSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getRatingLabel = (score: number) => {
    if (score >= 95) return 'Exceptional';
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 60) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  const getRatingColor = (score: number) => {
    if (score >= 95) return 'from-purple-500 via-pink-500 to-rose-500';
    if (score >= 90) return 'from-violet-500 via-purple-500 to-pink-500';
    if (score >= 80) return 'from-blue-500 via-indigo-500 to-purple-500';
    if (score >= 70) return 'from-cyan-500 via-blue-500 to-indigo-500';
    if (score >= 60) return 'from-emerald-500 via-cyan-500 to-blue-500';
    if (score >= 50) return 'from-yellow-500 via-emerald-500 to-cyan-500';
    return 'from-orange-500 via-yellow-500 to-emerald-500';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;
    updateValue(e.clientX);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onChange(localValue);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.touches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || disabled) return;
    updateValue(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      onChange(localValue);
    }
  };

  const updateValue = (clientX: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = Math.round(percentage * 1000) / 10; // One decimal place
    setLocalValue(newValue);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, localValue]);

  const displayValue = isDragging ? localValue : value;
  const percentage = (displayValue / 100) * 100;

  return (
    <div className="space-y-3">
      {/* Value Display */}
      <div className="flex items-baseline justify-between">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          key={displayValue}
          className="flex items-baseline gap-1"
        >
          <span className={`text-4xl font-light tracking-tight bg-gradient-to-r ${getRatingColor(displayValue)} bg-clip-text text-transparent`}>
            {displayValue.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500">/100</span>
        </motion.div>
        <motion.span
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          key={getRatingLabel(displayValue)}
          className={`text-sm font-medium bg-gradient-to-r ${getRatingColor(displayValue)} bg-clip-text text-transparent`}
        >
          {getRatingLabel(displayValue)}
        </motion.span>
      </div>

      {/* Slider Track */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`relative h-12 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-2xl shadow-inner ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Active Fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getRatingColor(displayValue)} rounded-2xl shadow-lg`}
          style={{ width: `${percentage}%` }}
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* Thumb */}
        <motion.div
          className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl border-4 ${
            isDragging ? 'scale-125' : 'scale-100'
          } transition-transform`}
          style={{
            left: `calc(${percentage}% - 20px)`,
            borderImage: `linear-gradient(to right, ${getRatingColor(displayValue)}) 1`,
          }}
          initial={false}
          animate={{ left: `calc(${percentage}% - 20px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${getRatingColor(displayValue)} opacity-20`} />
        </motion.div>

        {/* Tick Marks */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
          {[0, 25, 50, 75, 100].map((tick) => (
            <div key={tick} className="flex flex-col items-center">
              <div className={`w-px h-3 ${tick * 100 / 100 <= percentage ? 'bg-white/50' : 'bg-gray-300'}`} />
              <span className={`text-[10px] mt-1 ${tick * 100 / 100 <= percentage ? 'text-white/70 font-medium' : 'text-gray-400'}`}>
                {tick}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex gap-2">
        {[50, 70, 85, 95].map((quickValue) => (
          <button
            key={quickValue}
            onClick={() => {
              if (!disabled) {
                setLocalValue(quickValue);
                onChange(quickValue);
              }
            }}
            disabled={disabled}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              displayValue === quickValue
                ? `bg-gradient-to-r ${getRatingColor(quickValue)} text-white shadow-md`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {quickValue}
          </button>
        ))}
      </div>
    </div>
  );
}
