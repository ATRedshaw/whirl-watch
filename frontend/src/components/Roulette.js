import { useState, useEffect } from 'react';
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
  const [cyclingMedia, setCyclingMedia] = useState(null);
  const [spinInterval, setSpinInterval] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 640);
  
  // Filters similar to ListDetails
  const [filters, setFilters] = useState({
    mediaType: 'all',
    watchStatus: 'not_watched',
    minRating: 0,
    addedBy: 'all'
  });

  // Add a new state for tracking the complete loading state
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

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
        setIsLoadingComplete(true);
      }
    };

    fetchLists();
  }, []);

  // Update the list selection handler
  const handleListSelect = async (listId) => {
    if (!listId) {
      setSelectedList(null);
      setSelectedListDetails(null);
      setIsLoadingComplete(true);
      return;
    }

    setIsLoadingComplete(false);
    const selectedList = lists.find(l => l.id === Number(listId));
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setSelectedList(selectedList);
      setSelectedListDetails(data);
      setFilters(prev => ({ ...prev, addedBy: 'all' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingComplete(true);
    }
  };

  const getFilteredMedia = () => {
    if (!selectedListDetails?.media_items) return [];
    
    return selectedListDetails.media_items.filter(media => {
      const matchesType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
      const matchesStatus = filters.watchStatus === 'all' || media.watch_status === filters.watchStatus;
      const matchesRating = !filters.minRating || media.vote_average >= filters.minRating;
      const matchesUser = filters.addedBy === 'all' || media.added_by?.id === parseInt(filters.addedBy);
      
      return matchesType && matchesStatus && matchesRating && matchesUser;
    });
  };

  const handleSpin = () => {
    const filteredMedia = getFilteredMedia();
    if (filteredMedia.length === 0) return;

    setIsSpinning(true);
    setShowResultModal(true);
    
    // Start cycling through media
    let cycleCount = 0;
    const cycleInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * filteredMedia.length);
      setCyclingMedia(filteredMedia[randomIndex]);
      cycleCount++;
      
      // After 20 cycles (increased from 10), stop and select final media
      if (cycleCount >= 20) {
        clearInterval(cycleInterval);
        setSpinInterval(null);
        const finalIndex = Math.floor(Math.random() * filteredMedia.length);
        const selected = filteredMedia[finalIndex];
        setSelectedMedia(selected);
        setCyclingMedia(null);
        setIsSpinning(false);
      }
    }, 100); // Reduced from 200ms to 100ms for faster cycling

    setSpinInterval(cycleInterval);
  };

  const handleCloseModal = () => {
    if (spinInterval) {
      clearInterval(spinInterval);
      setSpinInterval(null);
    }
    setIsSpinning(false);
    setShowResultModal(false);
    setCyclingMedia(null);
  };

  const handleAddToInProgress = async () => {
    if (!selectedMedia) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const updates = {
        watch_status: 'in_progress',
        rating: null
      };

      const response = await fetch(`${apiUrl}/api/lists/${selectedList.id}/media/${selectedMedia.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      // Close the modal and reset states
      setShowResultModal(false);
      setSelectedMedia(null);
      setCyclingMedia(null);

      // Fetch fresh list details
      const detailsResponse = await fetch(`${apiUrl}/api/lists/${selectedList.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const detailsData = await detailsResponse.json();
      if (!detailsResponse.ok) throw new Error(detailsData.error);
      
      // Update the list details with fresh data
      setSelectedListDetails(detailsData);

    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
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
          <p className="text-gray-400">Give the wheel a whirl and let fate decide your next watch!</p>
        </motion.div>

        {/* Filters Panel with Emphasized List Selection */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* List Selection - First column, emphasized */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-blue-400 mb-1">
                Choose List *
              </label>
              <select
                value={selectedList?.id || ''}
                onChange={(e) => handleListSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-500/50"
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

            {/* Added By Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Added By</label>
              <select
                value={filters.addedBy}
                onChange={(e) => setFilters(prev => ({ ...prev, addedBy: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {selectedListDetails?.media_items
                  ?.reduce((users, item) => {
                    if (item.added_by && !users.some(u => u.id === item.added_by.id)) {
                      users.push(item.added_by);
                    }
                    return users;
                  }, [])
                  .sort((a, b) => a.username.localeCompare(b.username))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
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

        {/* Count Display */}
        <div className="text-center mb-4">
          {selectedList && (
            <p className="text-gray-400">
              <span className="font-semibold text-white">{getFilteredMedia().length}</span> items match your filters
            </p>
          )}
        </div>

        {/* Simple Button Section */}
        <div className="flex justify-center py-8">
          {!isLoadingComplete ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : !selectedList ? (
            <div className="text-center">
              <div className="text-gray-400">
                <h3 className="text-xl font-semibold mb-2">
                  Select a list to begin
                </h3>
                <p className="text-gray-500">
                  Choose a list from above to start the roulette
                </p>
              </div>
            </div>
          ) : getFilteredMedia().length > 0 ? (
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300 ${
                isSpinning
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'
              }`}
            >
              {isSpinning ? 'Choosing...' : 'Pick Something Random!'}
            </button>
          ) : (
            <div className="text-center">
              <div className="text-gray-400">
                <h3 className="text-xl font-semibold mb-2">
                  No media matches your filters
                </h3>
                <p className="text-gray-500">
                  Try adjusting your filters to include more options
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Result Modal */}
        <AnimatePresence>
          {showResultModal && (cyclingMedia || selectedMedia) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => !isSpinning && handleCloseModal()}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-800 rounded-lg w-full max-w-xl flex flex-col max-h-[90vh]"
              >
                {/* Header with Title */}
                <div className="p-6 border-b border-slate-700">
                  <h3 className="text-2xl font-semibold mb-2">
                    {isSpinning ? "Choosing your next watch..." : "Your Next Watch"}
                  </h3>
                  {!isSpinning && (
                    <h4 className="text-xl text-gray-200 sm:hidden">
                      {(cyclingMedia || selectedMedia).title || (cyclingMedia || selectedMedia).name}
                    </h4>
                  )}
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Poster */}
                    <div className="sm:w-1/3 flex-shrink-0">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden">
                        <img
                          src={`https://image.tmdb.org/t/p/w342${(cyclingMedia || selectedMedia).poster_path}`}
                          alt={(cyclingMedia || selectedMedia).title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/342x513?text=No+Image';
                          }}
                        />
                      </div>
                    </div>

                    {/* Details - Hidden on mobile during spinning */}
                    <div className="flex-1">
                      {(!isSpinning || isDesktop) && (
                        <>
                          <h4 className="text-xl font-semibold mb-3">
                            {(cyclingMedia || selectedMedia).title || (cyclingMedia || selectedMedia).name}
                          </h4>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-500">⭐</span>
                              <span className="font-medium">
                                {(cyclingMedia || selectedMedia).vote_average.toFixed(1)}
                              </span>
                            </div>
                            {(cyclingMedia || selectedMedia).release_date && (
                              <div className="text-sm text-gray-400">
                                Released: {new Date((cyclingMedia || selectedMedia).release_date).getFullYear()}
                              </div>
                            )}
                          </div>
                          <p className="text-gray-400 mb-6">
                            {(cyclingMedia || selectedMedia).overview}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Button Section */}
                {!isSpinning && (
                  <div className="p-4 border-t border-slate-700">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleAddToInProgress}
                        className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-200 font-medium"
                      >
                        Start Watching
                      </button>
                      <button
                        onClick={handleSpin}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-lg transition-colors duration-200 font-medium"
                      >
                        Respin
                      </button>
                      <button
                        onClick={() => setShowResultModal(false)}
                        className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Roulette;