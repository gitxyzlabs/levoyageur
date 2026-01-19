import { useState, useEffect } from 'react';
import { X, Star, Tag as TagIcon, Plus } from 'lucide-react';
import { api } from '../../utils/api';

interface EditorRatingModalProps {
  locationId: string;
  locationName: string;
  currentRating?: number;
  currentTags?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EditorRatingModal({
  locationId,
  locationName,
  currentRating,
  currentTags = [],
  onClose,
  onSuccess,
}: EditorRatingModalProps) {
  const [rating, setRating] = useState(currentRating?.toString() || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const { tags } = await api.getTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, []);

  // Filter tags based on input
  useEffect(() => {
    if (tagInput.trim()) {
      const filtered = availableTags.filter(
        (tag) =>
          tag.toLowerCase().includes(tagInput.toLowerCase()) &&
          !selectedTags.includes(tag)
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags([]);
    }
  }, [tagInput, availableTags, selectedTags]);

  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, numbers, and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setRating(value);
    }
  };

  const handleAddTag = async (tagName: string) => {
    const normalizedTag = tagName.toLowerCase().trim();
    if (!normalizedTag || selectedTags.includes(normalizedTag)) return;

    // Add tag to selected tags (will be saved to location when submitted)
    // No need to create tag separately - tags are stored as arrays on locations
    if (!availableTags.includes(normalizedTag)) {
      setAvailableTags([...availableTags, normalizedTag]);
    }

    setSelectedTags([...selectedTags, normalizedTag]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate rating
    const ratingValue = rating ? parseFloat(rating) : undefined;
    if (ratingValue !== undefined && (ratingValue < 0 || ratingValue > 11)) {
      setError('Rating must be between 0.0 and 11.0');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.updateLocationRating(locationId, ratingValue, selectedTags);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update rating:', error);
      setError(error.message || 'Failed to update rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Editor Rating</h2>
            <p className="text-sm text-slate-600 mt-1">{locationName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* LV Rating */}
          <div>
            <label htmlFor="rating" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Star className="h-4 w-4 text-amber-500" />
              LV Editors Score (0.0 - 11.0)
            </label>
            <input
              id="rating"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="11"
              value={rating}
              onChange={handleRatingChange}
              placeholder="Enter rating..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave empty to remove rating
            </p>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <TagIcon className="h-4 w-4 text-blue-500" />
              Tags
            </label>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {/* Tag Input */}
            <div className="relative">
              <input
                id="tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredTags.length > 0) {
                      handleAddTag(filteredTags[0]);
                    } else if (tagInput.trim()) {
                      handleAddTag(tagInput);
                    }
                  }
                }}
                placeholder="Type to search or create tags..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {/* Tag Suggestions Dropdown */}
              {tagInput && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {filteredTags.length > 0 ? (
                    filteredTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors text-sm"
                      >
                        {tag}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddTag(tagInput)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors text-sm flex items-center gap-2 text-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Create "{tagInput.toLowerCase().trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Search existing tags or create new ones
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}