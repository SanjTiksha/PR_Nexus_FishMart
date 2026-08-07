import { useMemo, useState } from 'react';
import { Star, ThumbsUp, MessageCircle, Trash2 } from 'lucide-react';

const Reviews = ({ isAdmin = false, reviews = [], onUpdateReviews }) => {

  const [newReview, setNewReview] = useState({ name: '', rating: 5, comment: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Newest reviews first (by date, then by id)
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const idA = typeof a.id === 'number' ? a.id : parseInt(a.id, 10) || 0;
      const idB = typeof b.id === 'number' ? b.id : parseInt(b.id, 10) || 0;
      return idB - idA;
    });
  }, [reviews]);

  const averageRating = sortedReviews.length
    ? sortedReviews.reduce((sum, review) => sum + review.rating, 0) / sortedReviews.length
    : 0;
  const totalReviews = sortedReviews.length;

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (newReview.name && newReview.comment && onUpdateReviews) {
      const review = {
        id: Date.now(),
        ...newReview,
        date: new Date().toISOString().split('T')[0],
        verified: false
      };
      onUpdateReviews([review, ...reviews]);
      setNewReview({ name: '', rating: 5, comment: '' });
      setShowReviewForm(false);
    }
  };

  const handleDeleteReview = (reviewId) => {
    if (window.confirm('Are you sure you want to delete this review?') && onUpdateReviews) {
      onUpdateReviews(reviews.filter(review => review.id !== reviewId));
    }
  };

  const renderStars = (rating, interactive = false, onRatingChange = null) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={interactive ? () => onRatingChange(star) : undefined}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Reviews Summary */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
            {isAdmin && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                🔧 Admin Mode
              </span>
            )}
          </div>
          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Write Review</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">{averageRating.toFixed(1)}</div>
            <div className="flex justify-center mb-2">
              {renderStars(Math.round(averageRating))}
            </div>
            <p className="text-gray-600">{totalReviews} reviews</p>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = sortedReviews.filter(r => r.rating === rating).length;
              const percentage = (count / totalReviews) * 100;
              return (
                <div key={rating} className="flex items-center space-x-2">
                  <span className="text-sm w-8">{rating}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="w-5 h-5 text-green-500" />
              <span className="text-sm">98% recommend this business</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
              <span className="text-sm">4.8/5 average rating</span>
            </div>
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-sm">Fast response time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Write a Review</h3>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={newReview.name}
                onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              {renderStars(newReview.rating, true, (rating) => 
                setNewReview({ ...newReview, rating })
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
              <textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Share your experience..."
                required
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Submit Review
              </button>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reviews List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedReviews.slice(0, isAdmin ? sortedReviews.length : 3).map((review) => (
          <div key={review.id} className="review-card bg-white rounded-2xl shadow-md p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300 border border-gray-200">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{review.name}</h4>
                  {review.verified && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ Verified</span>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center mb-3 text-yellow-400">
                {renderStars(review.rating)}
                <span className="text-xs text-gray-500 ml-2">{review.date}</span>
              </div>
              <p className="text-gray-700 leading-relaxed">{review.comment}</p>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <button className="hover:text-blue-600 transition-colors flex items-center space-x-1">
                <ThumbsUp className="w-4 h-4" />
                <span>Helpful</span>
              </button>
              <button className="hover:text-blue-600 transition-colors flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>Reply</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reviews;
