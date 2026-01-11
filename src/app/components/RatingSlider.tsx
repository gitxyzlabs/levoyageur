import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface RatingSliderProps {
  value: number; // 0.0-10.0 with one decimal
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean; // Compact mode for InfoWindow
}

export function RatingSlider({ value, onChange, disabled = false, compact = false }: RatingSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getRatingLabel = (score: number) => {
    if (score >= 9.5) return 'Exceptional';
    if (score >= 9.0) return 'Outstanding';
    if (score >= 8.0) return 'Excellent';
    if (score >= 7.0) return 'Very Good';
    if (score >= 6.0) return 'Good';
    if (score >= 5.0) return 'Fair';
    return 'Poor';
  };

  // Pastel/neutral color gradients
  const getRatingColor = (score: number) => {
    if (score >= 9.5) return 'from-rose-300 via-pink-300 to-purple-300';
    if (score >= 9.0) return 'from-purple-300 via-violet-300 to-indigo-300';
    if (score >= 8.0) return 'from-blue-300 via-indigo-300 to-purple-300';
    if (score >= 7.0) return 'from-cyan-300 via-teal-300 to-blue-300';
    if (score >= 6.0) return 'from-emerald-300 via-green-300 to-teal-300';
    if (score >= 5.0) return 'from-amber-300 via-yellow-300 to-emerald-300';
    return 'from-orange-300 via-amber-300 to-yellow-300';
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
    const newValue = Math.round(percentage * 100) / 10; // 0.0-10.0 with one decimal
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
  const percentage = (displayValue / 10) * 100;

  if (compact) {
    // Compact version for InfoWindow
    return (
      <div className="space-y-2">
        {/* Compact Value Display */}
        <div className="flex items-baseline justify-between">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={displayValue}
            className="flex items-baseline gap-1"
          >
            <span className={`text-2xl font-light tracking-tight bg-gradient-to-r ${getRatingColor(displayValue)} bg-clip-text text-transparent`}>
              {displayValue.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">/10</span>
          </motion.div>
          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={getRatingLabel(displayValue)}
            className="text-xs font-medium text-gray-500"
          >
            {getRatingLabel(displayValue)}
          </motion.span>
        </div>

        {/* Compact Slider Track */}
        <div
          ref={sliderRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`relative h-8 bg-gray-100 rounded-full shadow-sm ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {/* Active Fill */}
          <motion.div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getRatingColor(displayValue)} rounded-full`}
            style={{ width: `${percentage}%` }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />

          {/* Thumb */}
          <motion.div
            className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md border-2 border-gray-200 ${
              isDragging ? 'scale-110' : 'scale-100'
            } transition-transform`}
            style={{ left: `calc(${percentage}% - 12px)` }}
            initial={false}
            animate={{ left: `calc(${percentage}% - 12px)` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Compact Quick Select */}
        <div className="flex gap-1.5">
          {[5, 7, 8.5, 9.5].map((quickValue) => (
            <button
              key={quickValue}
              onClick={() => {
                if (!disabled) {
                  setLocalValue(quickValue);
                  onChange(quickValue);
                }
              }}
              disabled={disabled}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                Math.abs(displayValue - quickValue) < 0.1
                  ? `bg-gradient-to-r ${getRatingColor(quickValue)} text-white shadow-sm`
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {quickValue}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Full version for Editor Panel
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
          <span className="text-sm text-gray-400">/10</span>
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
          className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl border-4 border-gray-200 ${
            isDragging ? 'scale-125' : 'scale-100'
          } transition-transform`}
          style={{ left: `calc(${percentage}% - 20px)` }}
          initial={false}
          animate={{ left: `calc(${percentage}% - 20px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${getRatingColor(displayValue)} opacity-20`} />
        </motion.div>

        {/* Tick Marks */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
          {[0, 2.5, 5, 7.5, 10].map((tick) => (
            <div key={tick} className="flex flex-col items-center">
              <div className={`w-px h-3 ${tick <= displayValue ? 'bg-white/50' : 'bg-gray-300'}`} />
              <span className={`text-[10px] mt-1 ${tick <= displayValue ? 'text-white/70 font-medium' : 'text-gray-400'}`}>
                {tick}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex gap-2">
        {[5, 7, 8.5, 9.5].map((quickValue) => (
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
              Math.abs(displayValue - quickValue) < 0.1
                ? `bg-gradient-to-r ${getRatingColor(quickValue)} text-white shadow-md`
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {quickValue}
          </button>
        ))}
      </div>
    </div>
  );
}
