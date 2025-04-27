import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const History = () => {
  const navigate = useNavigate();
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedList, setSelectedList] = useState('all');
  const [lists, setLists] = useState([]);
  const itemsPerPage = 10;

  // Add new filter states
  const [filters, setFilters] = useState({
    search: '',
    mediaType: 'all',
    watchStatus: 'all'
  });
  const [sortBy, setSortBy] = useState('last_updated_desc');

  const [selectedMedia, setSelectedMedia] = useState(null);

  // Add state for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchMediaHistory = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch user's media directly from the user/media endpoint
        const userMediaResponse = await fetch(`${apiUrl}/api/user/media`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!userMediaResponse.ok) {
          throw new Error('Failed to fetch user media');
        }

        const userMediaData = await userMediaResponse.json();
        setMediaItems(userMediaData.media_items || []);

        // Fetch lists for filtering
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

      } catch (err) {
        setError(err.message);
        console.error('Error fetching history data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMediaHistory();
  }, [navigate]);

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedMedia]);

  const getFilteredAndSortedMedia = () => {
    return mediaItems
      .filter(media => {
        const matchesSearch = media.title.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        const matchesWatchStatus = filters.watchStatus === 'all' || media.watch_status === filters.watchStatus;
        const matchesList = selectedList === 'all' || media.list_id === parseInt(selectedList);
        
        return matchesSearch && matchesMediaType && matchesWatchStatus && matchesList;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'title_desc':
            return b.title.localeCompare(a.title);
          case 'added_date_desc':
            return new Date(b.added_date) - new Date(a.added_date);
          case 'added_date_asc':
            return new Date(a.added_date) - new Date(b.added_date);
          case 'last_updated_desc':
            return new Date(b.last_updated) - new Date(a.last_updated);
          case 'last_updated_asc':
            return new Date(a.last_updated) - new Date(b.last_updated);
          default:
            return 0;
        }
      });
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

      // Add last_updated timestamp
      const now = new Date().toISOString();
      updates.last_updated = now;

      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Use the correct endpoint pattern that matches the backend
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update media');
      }

      // Update local state
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                ...updates,
                last_updated: now,
                lastUpdatedDate: new Date(now) // Add for sorting purposes
              }
            : item
        )
      );

      // Update selected media state
      setSelectedMedia(prev => ({
        ...prev,
        ...updates,
        last_updated: now,
        lastUpdatedDate: new Date(now)
      }));
    } catch (error) {
      console.error('Error updating media:', error);
      setError('Failed to update media: ' + error.message);
    }
  };

  const handleRatingUpdate = async (mediaId, newRating) => {
    try {
      if (!selectedMedia) return;
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Construct the update object
      const updates = {
        rating: newRating ? Number(newRating) : null,
        last_updated: new Date().toISOString()
      };
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update rating');
      }

      // Update local state
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                rating: newRating ? Number(newRating) : null,
                last_updated: updates.last_updated,
                lastUpdatedDate: new Date(updates.last_updated)
              }
            : item
        )
      );

      // Update selected media state
      setSelectedMedia(prev => ({
        ...prev,
        rating: newRating ? Number(newRating) : null,
        last_updated: updates.last_updated,
        lastUpdatedDate: new Date(updates.last_updated)
      }));
    } catch (error) {
      console.error('Error updating rating:', error);
      setError('Failed to update rating: ' + error.message);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete media');
      }

      // Update local state by removing the deleted media
      setMediaItems(prevItems => prevItems.filter(item => item.id !== mediaId));
      setSelectedMedia(null);
      setShowDeleteConfirm(false);
      
    } catch (error) {
      console.error('Error deleting media:', error);
      setError('Failed to delete media: ' + error.message);
    }
  };

  const handleMediaClick = (media) => {
    setSelectedMedia(media);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8 flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading History</h2>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400"
          >
            Try Again
          </button>
        </div>
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
            <h1 className="text-3xl font-bold">Update History</h1>
          </div>
        </motion.div>

        {/* Show empty state if no media items */}
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Media History</h3>
              <p className="text-gray-500 mb-4">Start by adding some movies or TV shows to your lists!</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/search')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 text-white"
              >
                Search Media
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

                {/* Sort By */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="last_updated_desc">Recently Updated</option>
                    <option value="last_updated_asc">Oldest Updated</option>
                    <option value="added_date_desc">Recently Added</option>
                    <option value="added_date_asc">Oldest Added</option>
                    <option value="title_asc">Title (A-Z)</option>
                    <option value="title_desc">Title (Z-A)</option>
                  </select>
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilters({ search: '', mediaType: 'all', watchStatus: 'all' });
                      setSelectedList('all');
                      setSortBy('last_updated_desc');
                    }}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Media List */}
            <div className="space-y-4">
              {currentItems.map((media) => (
                <div
                  key={media.id}
                  onClick={() => handleMediaClick(media)}
                  className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors duration-200"
                >
                  {/* Poster - larger and consistent size */}
                  <img
                    src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                    alt={media.title}
                    className="w-16 h-24 object-cover rounded shrink-0"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/92x138?text=No+Image';
                    }}
                  />

                  {/* Content Container */}
                  <div className="flex-1 min-w-0">
                    {/* Title and List Name */}
                    <div className="mb-2">
                      <h3 className="font-medium text-base line-clamp-1">{media.title || media.name}</h3>
                      <p className="text-sm text-gray-400">From: {media.listName}</p>
                      <p className="text-xs text-gray-500">Added by: {media.added_by?.username || 'Unknown'}</p>
                    </div>

                    {/* Dates */}
                    <div className="space-y-1 mb-2">
                      <p className="text-xs text-gray-500">
                        Added: {new Date(media.added_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last Updated: {new Date(media.last_updated).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Watch Status Badge */}
                    <div className={`inline-block px-3 py-1 rounded text-sm ${
                      media.watch_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      media.watch_status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {media.watch_status === 'completed' ? 'Completed' :
                       media.watch_status === 'in_progress' ? 'In Progress' :
                       'Not Started'}
                    </div>
                  </div>
                </div>
              ))}
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
                className="absolute top-2 right-2 z-10 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            handleRatingUpdate(selectedMedia.id, value);
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

export default History;