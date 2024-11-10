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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    const fetchMediaHistory = async () => {
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

        // Sort by last_updated
        const sortedMedia = allMedia.sort((a, b) => 
          new Date(b.last_updated) - new Date(a.last_updated)
        );
        setMediaItems(sortedMedia);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMediaHistory();
  }, [navigate]);

  const getFilteredAndSortedMedia = () => {
    return mediaItems
      .filter(media => {
        const matchesSearch = media.title.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        const matchesWatchStatus = filters.watchStatus === 'all' || media.watch_status === filters.watchStatus;
        const matchesList = selectedList === 'all' || media.listId === parseInt(selectedList);
        
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

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <h3 className="text-red-500 font-semibold">Error loading history</h3>
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
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
                  onClick={() => setSelectedMedia(media)}
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
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedMedia(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h3 className="text-xl font-semibold">{selectedMedia.title}</h3>
                  <p className="text-sm text-gray-400">From: {selectedMedia.listName}</p>
                </div>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Watch Status */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Watch Status</label>
                <select
                  value={selectedMedia.watch_status || 'not_started'}
                  onChange={(e) => handleUpdateStatus(selectedMedia.id, { watch_status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Rating */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-1">Your Rating</label>
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

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!showDeleteConfirm ? (
                  <>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                    >
                      Remove from List
                    </button>
                    <button
                      onClick={() => navigate(`/lists/${selectedMedia.listId}`)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                    >
                      View List
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 space-y-2">
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
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;