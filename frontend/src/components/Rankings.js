import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Ratings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'highest');
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedList, setSelectedList] = useState('all');
  const [lists, setLists] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    mediaType: 'all'
  });
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedMedia]);

  useEffect(() => {
    const fetchRatedMedia = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch lists
        const listsResponse = await fetch(`${apiUrl}/api/lists`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!listsResponse.ok) {
          throw new Error('Failed to fetch lists');
        }

        const listsData = await listsResponse.json();
        const lists = Array.isArray(listsData) ? listsData : listsData.lists;
        setLists(lists);

        // Fetch all media items from each list
        const allMedia = [];

        for (const list of lists) {
          const listResponse = await fetch(`${apiUrl}/api/lists/${list.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const processedMedia = listData.media_items.map(item => ({
              ...item,
              listName: list.name,
              listId: list.id
            }));
            allMedia.push(...processedMedia);
          }
        }

        // Filter only rated media
        const ratedMedia = allMedia.filter(item => item.rating);
        setMediaItems(ratedMedia);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRatedMedia();
  }, [navigate]);

  const getFilteredAndSortedMedia = () => {
    return mediaItems
      .filter(media => {
        const matchesSearch = media.title?.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        const matchesList = selectedList === 'all' || media.listId === parseInt(selectedList);
        
        return matchesSearch && matchesMediaType && matchesList;
      })
      .sort((a, b) => activeTab === 'highest' ? b.rating - a.rating : a.rating - b.rating);
  };

  // Get current items for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = getFilteredAndSortedMedia().slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(getFilteredAndSortedMedia().length / itemsPerPage);

  const handleUpdateStatus = async (mediaId, updates) => {
    try {
      if (!selectedMedia) return;

      // If changing to non-completed status, clear rating
      if (updates.watch_status && updates.watch_status !== 'completed') {
        updates.rating = null;
      }

      const now = new Date().toISOString();
      updates.last_updated = now;

      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.listId}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update media');

      // Update local state
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === mediaId 
            ? { ...item, ...updates, last_updated: now }
            : item
        )
      );

      // Update selected media state
      setSelectedMedia(prev => ({
        ...prev,
        ...updates,
        last_updated: now
      }));
    } catch (error) {
      console.error('Error updating media:', error);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.listId}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete media');

      setMediaItems(prevItems => prevItems.filter(item => item.id !== mediaId));
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  const handleMediaClick = (media) => {
    setSelectedMedia(media);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <h3 className="text-red-500 font-semibold">Error loading ratings</h3>
        <p className="text-red-400">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
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
            <h1 className="text-3xl font-bold">All-Time Ratings</h1>
          </div>
        </motion.div>

        {/* Show empty state if no rated media */}
        {mediaItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <div className="text-gray-400">
              <svg 
                className="w-16 h-16 mx-auto mb-4 opacity-50" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Rated Media</h3>
              <p className="text-gray-500 mb-4">Rate some movies or TV shows to see them here!</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/lists')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 text-white"
              >
                View My Lists
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Filtration Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Search Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Search</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Search titles..."
                    className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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

                {/* List Filter */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">List</label>
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Lists</option>
                    {lists.map(list => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilters({ search: '', mediaType: 'all' });
                      setSelectedList('all');
                    }}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Centered Rating Tabs */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setActiveTab('highest')}
                className={`px-6 py-2 rounded-lg transition-colors duration-200 ${
                  activeTab === 'highest'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-700/50 text-gray-400 hover:text-white'
                }`}
              >
                Highest Rated
              </button>
              <button
                onClick={() => setActiveTab('lowest')}
                className={`px-6 py-2 rounded-lg transition-colors duration-200 ${
                  activeTab === 'lowest'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-700/50 text-gray-400 hover:text-white'
                }`}
              >
                Lowest Rated
              </button>
            </div>

            {/* No Results Message */}
            {mediaItems.length > 0 && getFilteredAndSortedMedia().length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-xl font-semibold mb-2">No matches found</h3>
                  <p className="text-gray-500">Try adjusting your filters</p>
                </div>
              </motion.div>
            )}

            {/* Media List */}
            <div className="space-y-4">
              {currentItems.map((media, index) => (
                <div
                  key={media.id}
                  onClick={() => handleMediaClick(media)}
                  className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors duration-200"
                >
                  <div className="text-gray-400 font-medium w-8">
                    #{indexOfFirstItem + index + 1}
                  </div>
                  <img
                    src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                    alt={media.title}
                    className="w-12 h-18 object-cover rounded"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/92x138?text=No+Image';
                    }}
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{media.title || media.name}</h3>
                    <p className="text-sm text-gray-400">From: {media.listName}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded ${
                    activeTab === 'highest' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    <span className="text-yellow-500">⭐</span>
                    <span className={`font-medium ${
                      activeTab === 'highest' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {media.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => setCurrentPage(index + 1)}
                    className={`w-8 h-8 rounded-lg ${
                      currentPage === index + 1
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Media Management Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setSelectedMedia(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-lg overflow-hidden max-w-2xl w-full my-auto relative flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button 
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Scrollable Container */}
              <div className="overflow-y-auto max-h-[80vh]">
                <div className="flex flex-col md:flex-row">
                  {/* Poster */}
                  <div className="w-full md:w-1/3">
                    {selectedMedia.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${selectedMedia.poster_path}`}
                        alt={selectedMedia.title || selectedMedia.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-slate-700 flex items-center justify-center">
                        <span className="text-gray-400">No poster available</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="w-full md:w-2/3 p-6">
                    <h2 className="text-2xl font-bold mb-2">
                      {selectedMedia.title || selectedMedia.name}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                      <span>{(selectedMedia.release_date || selectedMedia.first_air_date)?.split('-')[0]}</span>
                      {selectedMedia.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {selectedMedia.vote_average?.toFixed(1)}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-500/20 rounded text-xs font-medium text-blue-300 uppercase">
                        {selectedMedia.media_type}
                      </span>
                    </div>

                    {/* Overview */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Overview</h4>
                      <p className="text-gray-300 leading-relaxed">
                        {selectedMedia.overview || 'No overview available.'}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Watch Status</h4>
                      <select
                        value={selectedMedia.watch_status || 'not_watched'}
                        onChange={(e) => handleUpdateStatus(selectedMedia.id, { watch_status: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="not_watched">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Rating */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Your Rating</h4>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={selectedMedia.rating || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                            handleUpdateStatus(selectedMedia.id, { rating: value ? Number(value) : null });
                          }
                        }}
                        placeholder="1.0-10.0"
                        className={`w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                          ${selectedMedia.watch_status !== 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={selectedMedia.watch_status !== 'completed'}
                      />
                      {selectedMedia.watch_status !== 'completed' && (
                        <p className="text-sm text-gray-500 mt-1">
                          Complete watching to rate
                        </p>
                      )}
                    </div>

                    {/* List Information */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">List Information</h4>
                      <div className="flex items-center justify-between">
                        <p className="text-gray-200">{selectedMedia.listName}</p>
                        <button
                          onClick={() => navigate(`/lists/${selectedMedia.listId}`)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
                        >
                          View List
                        </button>
                      </div>
                    </div>

                    {/* Added/Updated Dates */}
                    {selectedMedia.added_date && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Added On</h4>
                        <p className="text-gray-200">{new Date(selectedMedia.added_date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</p>
                      </div>
                    )}
                    {selectedMedia.last_updated && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Last Updated</h4>
                        <p className="text-gray-200">{new Date(selectedMedia.last_updated).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</p>
                      </div>
                    )}

                    {/* Remove from List Button */}
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200 mt-2"
                      >
                        Remove from List
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-red-400 mb-2">
                          Are you sure you want to remove this from '{selectedMedia.listName}'?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteMedia(selectedMedia.id)}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                          >
                            Yes, Remove
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ratings;