import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const ListDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaToDelete, setMediaToDelete] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    mediaType: 'all'
  });
  const [sortBy, setSortBy] = useState('added_date_desc');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const fetchListDetails = async () => {
      try {
        if (!id || isNaN(id)) {
          navigate('/lists');
          throw new Error('Invalid list ID');
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${apiUrl}/api/lists/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login');
            throw new Error('Session expired. Please log in again.');
          }
          if (response.status === 404) {
            navigate('/lists');
            throw new Error('List not found');
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch list details');
        }

        const data = await response.json();
        setList(data);
      } catch (err) {
        console.error('Error fetching list details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchListDetails();
  }, [id, navigate]);

  const handleUpdateStatus = async (mediaId, updates) => {
    try {
      if (updates.watch_status && updates.watch_status !== 'completed') {
        updates.rating = null;
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${id}/media/${mediaId}`, {
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

      setList(prevList => ({
        ...prevList,
        media_items: prevList.media_items.map(item =>
          item.id === mediaId 
            ? {
                ...item,
                ...updates,
                rating: updates.watch_status && updates.watch_status !== 'completed' 
                  ? null 
                  : updates.rating !== undefined ? updates.rating : item.rating
              }
            : item
        )
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${id}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      setList(prevList => ({
        ...prevList,
        media_items: prevList.media_items.filter(item => item.id !== mediaId)
      }));
      setMediaToDelete(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const getFilteredAndSortedMedia = () => {
    if (!list?.media_items) return [];
    
    return list.media_items
      .filter(media => {
        const matchesSearch = media.title.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        
        return matchesSearch && matchesMediaType;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'title_desc':
            return b.title.localeCompare(a.title);
          case 'user_rating_desc':
            return (b.rating || 0) - (a.rating || 0);
          case 'user_rating_asc':
            return (a.rating || 0) - (b.rating || 0);
          case 'overall_rating_desc':
            return (b.vote_average || 0) - (a.vote_average || 0);
          case 'overall_rating_asc':
            return (a.vote_average || 0) - (b.vote_average || 0);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <h3 className="text-red-500 font-semibold">Error loading list</h3>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      {/* List Header - aligned with grid */}
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/lists')}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold">{list.name}</h1>
            {list.is_owner && (
              <button
                onClick={() => setShowShareModal(true)}
                className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share List
              </button>
            )}
          </div>
          <p className="text-gray-400">{list.description || 'No description'}</p>
        </motion.div>

        {/* Add Share Modal - place this just before the Delete Confirmation Modal */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
              >
                <h3 className="text-xl font-semibold mb-4">Share List</h3>
                <div className="mb-6">
                  <p className="text-gray-400 mb-2">Share this code with others to let them join your list:</p>
                  <div className="bg-slate-700 p-3 rounded-lg text-center">
                    <span className="font-mono text-lg">{list.share_code}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filtration Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Sort By */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="added_date_desc">Recently Added</option>
                <option value="added_date_asc">Oldest Added</option>
                <option value="last_updated_desc">Recently Updated</option>
                <option value="last_updated_asc">Oldest Updated</option>
                <option value="title_asc">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
                <option value="user_rating_desc">Your Rating (High-Low)</option>
                <option value="user_rating_asc">Your Rating (Low-High)</option>
                <option value="overall_rating_desc">Overall Rating (High-Low)</option>
                <option value="overall_rating_asc">Overall Rating (Low-High)</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ search: '', mediaType: 'all' });
                  setSortBy('added_date_desc');
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </motion.div>

        {/* Empty State Message */}
        {(!list.media_items || list.media_items.length === 0) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-gray-400 mb-6">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">This list is empty</h3>
              <p className="text-gray-500 mb-6">Start adding movies and TV shows to build your collection!</p>
              <button
                onClick={() => navigate('/search')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors duration-200 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search for Media
              </button>
            </div>
          </motion.div>
        ) : (
          /* Media Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {getFilteredAndSortedMedia().map(media => (
              <motion.div
                key={media.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden flex flex-col"
              >
                {/* Media Poster with Type Badge and Delete Button */}
                <div className="relative w-full aspect-[2/3]">
                  {media.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${media.poster_path}`}
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No poster</span>
                    </div>
                  )}
                  {/* Media Type Badge */}
                  <span className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-md text-xs font-medium capitalize">
                    {media.media_type}
                  </span>
                  {/* Delete Button - Update the condition to allow shared users to delete */}
                  {(list.is_owner || list.shared_with_me) && (
                    <button
                      onClick={() => setMediaToDelete(media)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors duration-200"
                      title="Remove from list"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Media Info */}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="text-lg font-semibold mb-1 line-clamp-1">
                    {media.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <span>{media.release_date?.split('-')[0]}</span>
                    {media.vote_average && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {media.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Watch Status - Also update these conditions for consistency */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">Watch Status</label>
                    <select
                      value={media.watch_status}
                      onChange={(e) => handleUpdateStatus(media.id, { watch_status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!(list.is_owner || list.shared_with_me)}
                    >
                      <option value="not_watched">Not Watched</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  {/* Rating - Update these conditions as well */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Your Rating</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={media.rating || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                          handleUpdateStatus(media.id, { rating: value ? Number(value) : null });
                        }
                      }}
                      placeholder="1.0-10.0"
                      className={`w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${media.watch_status !== 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!(list.is_owner || list.shared_with_me) || media.watch_status !== 'completed'}
                    />
                    {media.watch_status !== 'completed' && (
                      <p className="text-sm text-gray-500 mt-1">
                        Complete watching to rate
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add a "No Results" message when filters return empty */}
      {list.media_items?.length > 0 && getFilteredAndSortedMedia().length === 0 && (
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {mediaToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setMediaToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Remove from List</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to remove "{mediaToDelete?.title}" from this list?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteMedia(mediaToDelete.id)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  Remove
                </button>
                <button
                  onClick={() => setMediaToDelete(null)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ListDetails;