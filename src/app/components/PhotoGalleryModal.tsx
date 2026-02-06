import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface Photo {
  photoReference: string;
  width: number;
  height: number;
}

interface PhotoGalleryModalProps {
  photos: Photo[];
  initialIndex?: number;
  placeName: string;
  onClose: () => void;
}

export function PhotoGalleryModal({ photos, initialIndex = 0, placeName, onClose }: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[10000] flex items-center justify-center"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Photo Counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full backdrop-blur-md z-10">
          <p className="text-white text-sm font-medium">
            {currentIndex + 1} / {photos.length}
          </p>
        </div>

        {/* Place Name */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full backdrop-blur-md z-10 max-w-md">
          <p className="text-white text-sm font-medium text-center truncate">{placeName}</p>
        </div>

        {/* Main Image */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-7xl max-h-[90vh] mx-auto px-20"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={photos[currentIndex].photoReference}
            alt={`${placeName} - Photo ${currentIndex + 1}`}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
        </motion.div>

        {/* Navigation Buttons */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 max-w-2xl overflow-x-auto px-4 pb-2">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-white scale-110'
                    : 'border-white/30 hover:border-white/60 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.photoReference}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}