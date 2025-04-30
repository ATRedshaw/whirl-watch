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
    minRating: 0,
    addedBy: 'all'
  });

  // Add a new state for tracking the complete loading state
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  // State for multi-user selection
  const [listUsers, setListUsers] = useState([]);

  // State for watch status filter
  const [watchStatusFilter, setWatchStatusFilter] = useState({
    mode: 'any',
    status: 'not_watched',
    users: []
  });

  // Add state for controlling the filter modal
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Add state for storing temporary filter settings in the modal
  const [tempFilterSettings, setTempFilterSettings] = useState({
    mode: 'any',
    status: 'not_watched',
    users: []
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
      setListUsers([]);
      return;
    }

    setIsLoadingComplete(false);
    const selectedList = lists.find(l => l.id === Number(listId));
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Use our new roulette endpoint to get media with user ratings
      const rouletteResponse = await fetch(`${apiUrl}/api/lists/${listId}/roulette`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const rouletteData = await rouletteResponse.json();
      if (!rouletteResponse.ok) throw new Error(rouletteData.error);
      
      // Set list users from the response
      if (rouletteData.users && rouletteData.users.length > 0) {
        setListUsers(rouletteData.users);
        
        // Set all users as selected by default in the watch status filter
        const allUserIds = rouletteData.users.map(user => user.id);
        setWatchStatusFilter(prev => ({
          ...prev,
          users: allUserIds
        }));
        
        // Also update the temporary filter settings
        setTempFilterSettings(prev => ({
          ...prev,
          users: allUserIds
        }));
      }
      
      setSelectedList(selectedList);
      
      // Create an object with the format expected by the component
      const formattedListDetails = {
        id: selectedList.id,
        name: selectedList.name,
        media_items: rouletteData.media_items || []
      };
      
      setSelectedListDetails(formattedListDetails);
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
      // Basic filters
      const matchesType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
      const matchesRating = !filters.minRating || media.vote_average >= filters.minRating;
      const matchesUser = filters.addedBy === 'all' || media.added_by?.id === parseInt(filters.addedBy);
      
      // Check if this media matches the watch status filter for selected users
      let matchesWatchStatusFilter = true;
      
      if (watchStatusFilter.users.length > 0) {
        // Different filtering logic based on mode
        if (watchStatusFilter.mode === 'any') {
          // ANY: At least one selected user must have the specified status
          matchesWatchStatusFilter = watchStatusFilter.users.some(userId => {
            // Get the user's rating for this media from the user_ratings object
            const userRating = media.user_ratings[userId];
            
            // If looking for 'not_watched' and there's no rating for this user, that counts as a match
            if (watchStatusFilter.status === 'not_watched' && (!userRating || userRating.watch_status === 'not_watched')) {
              return true;
            }
            
            return userRating && userRating.watch_status === watchStatusFilter.status;
          });
        } 
        else if (watchStatusFilter.mode === 'all') {
          // ALL: All selected users must have the specified status
          matchesWatchStatusFilter = watchStatusFilter.users.every(userId => {
            // Get the user's rating for this media from the user_ratings object
            const userRating = media.user_ratings[userId];
            
            // If looking for 'not_watched' and there's no rating for this user, that counts as a match
            if (watchStatusFilter.status === 'not_watched' && (!userRating || userRating.watch_status === 'not_watched')) {
              return true;
            }
            
            return userRating && userRating.watch_status === watchStatusFilter.status;
          });
        }
      }
      
      return matchesType && matchesRating && matchesUser && matchesWatchStatusFilter;
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* List Selection - Full width */}
            <div className="sm:col-span-3 mb-4">
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

          {/* User filter button - replaces the existing complex UI */}
          {selectedList && listUsers.length > 0 && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold text-blue-400">User Filter:</span>
                  {watchStatusFilter.users.length > 0 && (
                    <span className="ml-2 text-sm text-gray-300">
                      {watchStatusFilter.users.length} {watchStatusFilter.users.length === 1 ? 'user' : 'users'} selected
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setTempFilterSettings({...watchStatusFilter});
                    setShowFilterModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
                >
                  Configure User Filters
                </button>
              </div>
              
              {/* Summary of active filter */}
              {watchStatusFilter.users.length > 0 && (
                <div className="mt-3 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-blue-400">
                      {watchStatusFilter.mode === 'none' 
                        ? 'Showing media not watched by any selected user'
                        : watchStatusFilter.mode === 'all'
                        ? `Showing media where all selected users have status: ${watchStatusFilter.status.replace('_', ' ')}`
                        : `Showing media where any selected user has status: ${watchStatusFilter.status.replace('_', ' ')}`
                      }
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
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

        {/* User Filter Modal */}
        <AnimatePresence>
          {showFilterModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => setShowFilterModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-800 rounded-lg max-w-md w-full max-h-[90vh] flex flex-col"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">User Filter Settings</h3>
                  <button 
                    onClick={() => setShowFilterModal(false)}
                    className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-4 overflow-y-auto flex-1">
                  {/* Filter Mode Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-blue-400 mb-3">
                      Filter Mode:
                    </label>
                    <div className="space-y-3">
                      <button
                        onClick={() => setTempFilterSettings(prev => ({...prev, mode: 'any'}))}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center ${
                          tempFilterSettings.mode === 'any'
                            ? 'bg-blue-500/30 border border-blue-500'
                            : 'bg-slate-700/50 hover:bg-slate-700'
                        }`}
                      >
                        <div className="mr-3">
                          <div className={`w-5 h-5 rounded-full border ${
                            tempFilterSettings.mode === 'any' 
                              ? 'border-blue-500 flex items-center justify-center' 
                              : 'border-gray-400'
                          }`}>
                            {tempFilterSettings.mode === 'any' && (
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Any user has status</div>
                          <div className="text-sm text-gray-400">Show media where at least one selected user has the specified status</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setTempFilterSettings(prev => ({...prev, mode: 'all'}))}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center ${
                          tempFilterSettings.mode === 'all'
                            ? 'bg-blue-500/30 border border-blue-500'
                            : 'bg-slate-700/50 hover:bg-slate-700'
                        }`}
                      >
                        <div className="mr-3">
                          <div className={`w-5 h-5 rounded-full border ${
                            tempFilterSettings.mode === 'all' 
                              ? 'border-blue-500 flex items-center justify-center' 
                              : 'border-gray-400'
                          }`}>
                            {tempFilterSettings.mode === 'all' && (
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">All users have status</div>
                          <div className="text-sm text-gray-400">Show media where all selected users have the specified status</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Watch Status Selection - Only visible for "all" and "any" modes */}
                  {tempFilterSettings.mode !== 'none' && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-blue-400 mb-2">
                        Watch Status:
                      </label>
                      <select
                        value={tempFilterSettings.status}
                        onChange={(e) => setTempFilterSettings(prev => ({...prev, status: e.target.value}))}
                        className="w-full px-4 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="not_watched">Not Watched</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  )}

                  {/* User Selection */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-blue-400">
                        Select Users:
                      </label>
                      <div className="flex space-x-2">
                        {listUsers.length > 0 && (
                          <button
                            onClick={() => setTempFilterSettings(prev => ({...prev, users: listUsers.map(user => user.id)}))}
                            className="text-xs px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors duration-200"
                          >
                            Select All
                          </button>
                        )}
                        {tempFilterSettings.users.length > 0 && (
                          <button
                            onClick={() => setTempFilterSettings(prev => ({...prev, users: []}))}
                            className="text-xs px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors duration-200"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {listUsers.length > 0 ? (
                        <div className="space-y-2">
                          {listUsers.map(user => (
                            <div 
                              key={user.id}
                              onClick={() => {
                                setTempFilterSettings(prev => {
                                  const isSelected = prev.users.includes(user.id);
                                  return {
                                    ...prev,
                                    users: isSelected
                                      ? prev.users.filter(id => id !== user.id)
                                      : [...prev.users, user.id]
                                  };
                                });
                              }}
                              className={`p-2 rounded flex items-center cursor-pointer transition-colors duration-200 ${
                                tempFilterSettings.users.includes(user.id)
                                  ? 'bg-blue-500/30'
                                  : 'hover:bg-slate-700'
                              }`}
                            >
                              <div className={`w-5 h-5 mr-3 rounded border flex items-center justify-center ${
                                tempFilterSettings.users.includes(user.id)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-gray-400'
                              }`}>
                                {tempFilterSettings.users.includes(user.id) && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"></path>
                                  </svg>
                                )}
                              </div>
                              <span>{user.username}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center py-3">No users available</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {tempFilterSettings.users.length === 0 
                        ? "No users selected" 
                        : `${tempFilterSettings.users.length} user${tempFilterSettings.users.length > 1 ? 's' : ''} selected`}
                    </p>
                  </div>

                  {/* Filter Preview */}
                  {tempFilterSettings.users.length > 0 && (
                    <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg mb-6">
                      <h4 className="text-sm font-semibold text-blue-400 mb-1">Filter Preview:</h4>
                      <p className="text-sm text-gray-300">
                        {(() => {
                          // Get the selected users' usernames
                          const selectedUsernames = tempFilterSettings.users
                            .map(id => listUsers.find(user => user.id === id)?.username)
                            .filter(Boolean);
                          
                          // Format status for display
                          const statusDisplay = tempFilterSettings.status.replace('_', ' ');
                          
                          // Construct user list with proper grammar
                          let userListText = '';
                          
                          // Return the appropriate message based on filter mode
                          if (tempFilterSettings.mode === 'none') {
                            // For "none" mode, use commas and "and"
                            if (selectedUsernames.length === 1) {
                              userListText = selectedUsernames[0];
                            } else if (selectedUsernames.length === 2) {
                              userListText = `${selectedUsernames[0]} and ${selectedUsernames[1]}`;
                            } else if (selectedUsernames.length > 2) {
                              const lastUsername = selectedUsernames.pop();
                              userListText = `${selectedUsernames.join(', ')}, and ${lastUsername}`;
                              // Restore the array
                              selectedUsernames.push(lastUsername);
                            }
                            return `Show media not watched by ${userListText}`;
                          } else if (tempFilterSettings.mode === 'all') {
                            // For "all" mode, use commas and "and"
                            if (selectedUsernames.length === 1) {
                              userListText = selectedUsernames[0];
                            } else if (selectedUsernames.length === 2) {
                              userListText = `${selectedUsernames[0]} and ${selectedUsernames[1]}`;
                            } else if (selectedUsernames.length > 2) {
                              const lastUsername = selectedUsernames.pop();
                              userListText = `${selectedUsernames.join(', ')}, and ${lastUsername}`;
                              // Restore the array
                              selectedUsernames.push(lastUsername);
                            }
                            const verb = selectedUsernames.length === 1 ? 'has' : 'have';
                            return `Show media where ${userListText} ${verb} status "${statusDisplay}"`;
                          } else { // 'any' mode - use "or" instead of "and"
                            if (selectedUsernames.length === 1) {
                              userListText = selectedUsernames[0];
                              return `Show media where ${userListText} has status "${statusDisplay}"`;
                            } else if (selectedUsernames.length === 2) {
                              return `Show media where either ${selectedUsernames[0]} or ${selectedUsernames[1]} has status "${statusDisplay}"`;
                            } else {
                              // For "any" mode with 3+ users, use "or" between items
                              const lastUsername = selectedUsernames.pop();
                              userListText = `${selectedUsernames.join(', ')}, or ${lastUsername}`;
                              // Restore the array
                              selectedUsernames.push(lastUsername);
                              return `Show media where either ${userListText} has status "${statusDisplay}"`;
                            }
                          }
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with buttons */}
                <div className="p-4 border-t border-slate-700">
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        // Apply filter settings
                        setWatchStatusFilter({...tempFilterSettings});
                        setShowFilterModal(false);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={() => setShowFilterModal(false)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
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