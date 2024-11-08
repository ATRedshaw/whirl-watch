import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Roulette = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [selectedListDetails, setSelectedListDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const wheelRef = useRef(null);
  
  // Filters similar to ListDetails
  const [filters, setFilters] = useState({
    mediaType: 'all',
    watchStatus: 'not_watched', // Default to unwatched items
    minRating: 0,
  });

  // Fetch user's lists on component mount
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/lists`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLists(data.lists);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, []);

  // Fetch list details when a list is selected
  useEffect(() => {
    const fetchListDetails = async () => {
      if (!selectedList?.id) return;
      
      try {
        setLoading(true);
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/lists/${selectedList.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSelectedListDetails(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchListDetails();
  }, [selectedList?.id]);

  const getFilteredMedia = () => {
    if (!selectedListDetails?.media_items) return [];
    
    return selectedListDetails.media_items.filter(media => {
      const matchesType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
      const matchesStatus = filters.watchStatus === 'all' || media.watch_status === filters.watchStatus;
      const matchesRating = !filters.minRating || media.vote_average >= filters.minRating;
      
      return matchesType && matchesStatus && matchesRating;
    });
  };

  const handleSpin = () => {
    const filteredMedia = getFilteredMedia();
    if (filteredMedia.length === 0) return;

    setIsSpinning(true);
    const randomIndex = Math.floor(Math.random() * filteredMedia.length);
    const selected = filteredMedia[randomIndex];

    // Animate wheel
    if (wheelRef.current) {
      const rotations = 5; // Number of full rotations
      const degreePerItem = 360 / filteredMedia.length;
      const finalRotation = (rotations * 360) + (randomIndex * degreePerItem);
      
      wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
      wheelRef.current.style.transition = 'transform 3s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    // Show result after animation
    setTimeout(() => {
      setSelectedMedia(selected);
      setIsSpinning(false);
      setShowResultModal(true);
    }, 3000);
  };

  const handleAddToInProgress = async () => {
    if (!selectedMedia) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      await fetch(`${apiUrl}/api/lists/${selectedList.id}/media/${selectedMedia.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          watch_status: 'in_progress'
        })
      });

      // Update local state
      setSelectedList(prev => ({
        ...prev,
        media_items: prev.media_items.map(item =>
          item.id === selectedMedia.id
            ? { ...item, watch_status: 'in_progress' }
            : item
        )
      }));

      setShowResultModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/hub')}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold">Movie Roulette</h1>
          </div>
          <p className="text-gray-400">Let fate decide your next watch!</p>
        </motion.div>

        {/* Selection Panel */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* List Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Choose List</label>
              <select
                value={selectedList?.id || ''}
                onChange={(e) => setSelectedList(lists.find(l => l.id === Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a list</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>

            {/* Media Type Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Media Type</label>
              <select
                value={filters.mediaType}
                onChange={(e) => setFilters(prev => ({ ...prev, mediaType: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="movie">Movies</option>
                <option value="tv">TV Shows</option>
              </select>
            </div>

            {/* Watch Status Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Watch Status</label>
              <select
                value={filters.watchStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, watchStatus: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="not_watched">Not Watched</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Minimum Rating Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Minimum Rating</label>
              <select
                value={filters.minRating}
                onChange={(e) => setFilters(prev => ({ ...prev, minRating: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Any Rating</option>
                {[6, 7, 8, 9].map(rating => (
                  <option key={rating} value={rating}>{rating}+ Stars</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Show loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading...</p>
          </div>
        )}

        {/* Show error state */}
        {error && (
          <div className="text-center py-12 text-red-400">
            <p>{error}</p>
          </div>
        )}

        {/* Roulette Wheel Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8"
        >
          {selectedList && getFilteredMedia().length > 0 ? (
            <>
              <div className="relative w-64 h-64 sm:w-96 sm:h-96 mb-8">
                <div
                  ref={wheelRef}
                  className="absolute inset-0 rounded-full border-4 border-rose-500 bg-slate-800"
                >
                  {getFilteredMedia().map((media, index) => {
                    const rotation = (360 / getFilteredMedia().length) * index;
                    return (
                      <div
                        key={media.id}
                        className="absolute w-full h-full"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          <img
                            src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                            alt={media.title}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Center pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3.5l-7 7h14l-7-7z" />
                  </svg>
                </div>
              </div>

              <button
                onClick={handleSpin}
                disabled={isSpinning}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 ${
                  isSpinning
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'
                }`}
              >
                {isSpinning ? 'Spinning...' : 'Spin the Wheel!'}
              </button>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <h3 className="text-xl font-semibold mb-2">
                  {!selectedList ? 'Select a list to begin' : 'No media matches your filters'}
                </h3>
                <p className="text-gray-500">
                  {!selectedList
                    ? 'Choose a list from above to start the roulette'
                    : 'Try adjusting your filters to include more options'}
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Result Modal */}
        <AnimatePresence>
          {showResultModal && selectedMedia && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => setShowResultModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-800 rounded-lg p-6 max-w-xl w-full"
              >
                <h3 className="text-2xl font-semibold mb-6">Your Next Watch</h3>
                <div className="flex gap-6 mb-6">
                  <div className="w-1/3 flex-shrink-0">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden">
                      <img
                        src={`https://image.tmdb.org/t/p/w342${selectedMedia.poster_path}`}
                        alt={selectedMedia.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/342x513?text=No+Image';
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold mb-3">{selectedMedia.title || selectedMedia.name}</h4>
                    <p className="text-gray-400 mb-4 line-clamp-4">{selectedMedia.overview}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium">{selectedMedia.vote_average.toFixed(1)}</span>
                    </div>
                    {selectedMedia.release_date && (
                      <div className="text-sm text-gray-400">
                        Released: {new Date(selectedMedia.release_date).getFullYear()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleAddToInProgress}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-200 font-medium"
                  >
                    Start Watching
                  </button>
                  <button
                    onClick={() => setShowResultModal(false)}
                    className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Roulette;