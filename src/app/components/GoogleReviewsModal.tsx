import { X, Star, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

interface GoogleReviewsModalProps {
  reviews: GoogleReview[];
  placeName: string;
  googleMapsUrl?: string;
  onClose: () => void;
}

export function GoogleReviewsModal({ reviews, placeName, googleMapsUrl, onClose }: GoogleReviewsModalProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Google Reviews</h2>
              <p className="text-sm text-gray-600 mt-0.5">{placeName}</p>
              <p className="text-xs text-gray-500 mt-1">
                Showing {reviews.length} most helpful review{reviews.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View All on Google</span>
                </a>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="overflow-y-auto max-h-[calc(80vh-88px)] px-6 py-4">
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No reviews available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((review, index) => (
                  <div key={index} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                    {/* Author Info */}
                    <div className="flex items-start gap-3 mb-3">
                      {review.profile_photo_url ? (
                        <img
                          src={review.profile_photo_url}
                          alt={review.author_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {review.author_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {review.author_url ? (
                            <a
                              href={review.author_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {review.author_name}
                            </a>
                          ) : (
                            <span className="font-semibold text-gray-900">{review.author_name}</span>
                          )}
                          <span className="text-sm text-gray-500">{review.relative_time_description}</span>
                        </div>
                        <div className="mt-1">{renderStars(review.rating)}</div>
                      </div>
                    </div>

                    {/* Review Text */}
                    {review.text && (
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{review.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}