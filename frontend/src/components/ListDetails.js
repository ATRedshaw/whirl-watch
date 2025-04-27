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
  const [selectedMediaInfo, setSelectedMediaInfo] = useState(null);
  const [mediaRatings, setMediaRatings] = useState(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    mediaType: 'all',
    addedBy: 'all',
    watchStatus: 'all'
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
                user_rating: {
                  ...item.user_rating,
                  watch_status: updates.watch_status || item.user_rating.watch_status,
                  rating: updates.watch_status && updates.watch_status !== 'completed' 
                    ? null 
                    : updates.rating !== undefined ? updates.rating : item.user_rating.rating
                }
              }
            : item
        )
      }));
      
      if (mediaRatings && selectedMediaInfo && selectedMediaInfo.id === mediaId) {
        fetchMediaRatings(mediaId);
      }
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
  
  const fetchMediaRatings = async (mediaId) => {
    try {
      setLoadingRatings(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${id}/media/${mediaId}/ratings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch ratings');
      }
      
      const data = await response.json();
      setMediaRatings(data);
    } catch (err) {
      console.error('Error fetching media ratings:', err);
    } finally {
      setLoadingRatings(false);
    }
  };
  
  const handleViewMediaDetails = (media) => {
    setSelectedMediaInfo(media);
    setMediaRatings(null);
    if (media.id) {
      fetchMediaRatings(media.id);
    }
  };

  const getFilteredAndSortedMedia = () => {
    if (!list?.media_items) return [];
    
    return list.media_items
      .filter(media => {
        const matchesSearch = media.title.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        const matchesAddedBy = filters.addedBy === 'all' || media.added_by?.id === parseInt(filters.addedBy);
        const matchesWatchStatus = filters.watchStatus === 'all' || media.user_rating?.watch_status === filters.watchStatus;
        
        return matchesSearch && matchesMediaType && matchesAddedBy && matchesWatchStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'title_desc':
            return b.title.localeCompare(a.title);
          case 'user_rating_desc':
            return (b.user_rating?.rating || 0) - (a.user_rating?.rating || 0);
          case 'user_rating_asc':
            return (a.user_rating?.rating || 0) - (b.user_rating?.rating || 0);
          case 'avg_rating_desc':
            return (b.avg_rating || 0) - (a.avg_rating || 0);
          case 'avg_rating_asc':
            return (a.avg_rating || 0) - (b.avg_rating || 0);
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

  useEffect(() => {
    if (list) {
      console.log('List data:', list);
    }
  }, [list]);

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

            {/* Added By Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Added By</label>
              <select
                value={filters.addedBy}
                onChange={(e) => setFilters(prev => ({ ...prev, addedBy: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {list.media_items
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
                  ))
                }
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
                <option value="avg_rating_desc">List Avg. Rating (High-Low)</option>
                <option value="avg_rating_asc">List Avg. Rating (Low-High)</option>
                <option value="overall_rating_desc">TMDB Rating (High-Low)</option>
                <option value="overall_rating_asc">TMDB Rating (Low-High)</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ search: '', mediaType: 'all', addedBy: 'all', watchStatus: 'all' });
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
                className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
              >
                {/* Mobile Layout (Horizontal Card) */}
                <div className="sm:hidden flex gap-4 p-4">
                  {/* Left side - Poster */}
                  <div 
                    className="relative w-24 h-36 shrink-0 cursor-pointer"
                    onClick={() => handleViewMediaDetails(media)}
                  >
                    {media.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                        alt={media.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-700 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No poster</span>
                      </div>
                    )}
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-xs font-medium capitalize">
                      {media.media_type}
                    </span>
                  </div>

                  {/* Right side - Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div 
                        className="cursor-pointer"
                        onClick={() => handleViewMediaDetails(media)}
                      >
                        <h3 className="font-medium text-base line-clamp-1">{media.title}</h3>
                        <p className="text-xs text-gray-400">Added by {media.added_by?.username || 'Unknown'}</p>
                      </div>
                      {/* Delete Button */}
                      {(list.is_owner || list.shared_with_me) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaToDelete(media);
                          }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Info Row */}
                    <div 
                      className="flex items-center gap-2 text-xs text-gray-400 mt-1 mb-2 cursor-pointer"
                      onClick={() => handleViewMediaDetails(media)}
                    >
                      <span>{media.release_date?.split('-')[0]}</span>
                      
                      {/* User Rating */}
                      {media.user_rating?.rating && (
                        <span className="flex items-center gap-1 bg-blue-500/20 px-1 rounded">
                          <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-blue-300 font-medium">{media.user_rating.rating}</span>
                        </span>
                      )}
                      
                      {/* List Avg Rating */}
                      {media.avg_rating && (
                        <span className="flex items-center gap-1 bg-purple-500/20 px-1 rounded">
                          <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-purple-300">{media.avg_rating.toFixed(1)}</span>
                        </span>
                      )}
                      
                      {/* TMDB Rating */}
                      {media.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {media.vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Watch Status */}
                    <select
                      value={media.user_rating?.watch_status || 'not_watched'}
                      onChange={(e) => handleUpdateStatus(media.id, { watch_status: e.target.value })}
                      className="w-full px-2 py-1 text-sm bg-slate-700 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!(list.is_owner || list.shared_with_me)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="not_watched">Not Watched</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>

                    {/* Rating Input - Always show but disable when not completed */}
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={media.user_rating?.rating || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                            handleUpdateStatus(media.id, { rating: value ? Number(value) : null });
                          }
                        }}
                        placeholder="Your rating (1-10)"
                        className={`w-full px-2 py-1 text-sm bg-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500
                          ${media.user_rating?.watch_status !== 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!(list.is_owner || list.shared_with_me) || media.user_rating?.watch_status !== 'completed'}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {media.user_rating?.watch_status !== 'completed' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Complete watching to rate
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Layout (Original Vertical Card) */}
                <div className="hidden sm:flex sm:flex-col">
                  {/* Media Poster with Type Badge and Delete Button */}
                  <div 
                    className="relative w-full aspect-[2/3] cursor-pointer"
                    onClick={() => handleViewMediaDetails(media)}
                  >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaToDelete(media);
                        }}
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
                    <div
                      className="cursor-pointer"
                      onClick={() => handleViewMediaDetails(media)}
                    >
                      <h3 className="text-lg font-semibold mb-1 line-clamp-1">
                        {media.title}
                      </h3>
                      <p className="text-sm text-gray-400 mb-2">
                        Added by {media.added_by?.username || 'Unknown'}
                      </p>
                      
                      <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                        <span>{media.release_date?.split('-')[0]}</span>
                        
                        {/* Ratings Box */}
                        <div className="flex gap-1 ml-auto">
                          {/* Your Rating */}
                          {media.user_rating?.rating && (
                            <span className="flex items-center gap-1 bg-blue-500/20 px-2 py-0.5 rounded">
                              <span className="text-blue-300 font-medium">{media.user_rating.rating}</span>
                              <span className="text-xs text-blue-400">you</span>
                            </span>
                          )}
                          
                          {/* List Average */}
                          {media.avg_rating && (
                            <span className="flex items-center gap-1 bg-purple-500/20 px-2 py-0.5 rounded">
                              <span className="text-purple-300 font-medium">{media.avg_rating.toFixed(1)}</span>
                              <span className="text-xs text-purple-400">avg</span>
                            </span>
                          )}
                          
                          {/* TMDB Rating */}
                          {media.vote_average && (
                            <span className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded">
                              <span className="text-yellow-300 font-medium">{media.vote_average.toFixed(1)}</span>
                              <span className="text-xs text-yellow-400">tmdb</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Watch Status */}
                    <div className="mb-3">
                      <label className="block text-sm text-gray-400 mb-1">Watch Status</label>
                      <select
                        value={media.user_rating?.watch_status || 'not_watched'}
                        onChange={(e) => handleUpdateStatus(media.id, { watch_status: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!(list.is_owner || list.shared_with_me)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="not_watched">Not Watched</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Rating */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Your Rating</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={media.user_rating?.rating || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                            handleUpdateStatus(media.id, { rating: value ? Number(value) : null });
                          }
                        }}
                        placeholder="1.0-10.0"
                        className={`w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                          ${media.user_rating?.watch_status !== 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!(list.is_owner || list.shared_with_me) || media.user_rating?.watch_status !== 'completed'}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {media.user_rating?.watch_status !== 'completed' && (
                        <p className="text-sm text-gray-500 mt-1">
                          Complete watching to rate
                        </p>
                      )}
                    </div>
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
                <span className="block mt-2 text-gray-400 text-sm">
                  Note: Your personal rating will be preserved and will be applied automatically if you add this title to any list again.
                </span>
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

      {/* Media Information Modal */}
      <AnimatePresence>
        {selectedMediaInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => {
              setSelectedMediaInfo(null);
              setMediaRatings(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-lg overflow-hidden max-w-3xl w-full my-auto relative flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button 
                onClick={() => {
                  setSelectedMediaInfo(null);
                  setMediaRatings(null);
                }}
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
                    {selectedMediaInfo.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${selectedMediaInfo.poster_path}`}
                        alt={selectedMediaInfo.title || selectedMediaInfo.name}
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
                      {selectedMediaInfo.title || selectedMediaInfo.name}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                      <span>{(selectedMediaInfo.release_date || selectedMediaInfo.first_air_date)?.split('-')[0]}</span>
                      {selectedMediaInfo.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8-2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {selectedMediaInfo.vote_average?.toFixed(1)} (TMDB)
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-500/20 rounded text-xs font-medium text-blue-300 uppercase">
                        {selectedMediaInfo.media_type}
                      </span>
                    </div>

                    {/* Overview */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Overview</h4>
                      <p className="text-gray-300 leading-relaxed">
                        {selectedMediaInfo.overview || 'No overview available.'}
                      </p>
                    </div>

                    {/* Your Rating */}
                    <div className="mb-5 bg-slate-700/50 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-400 mb-3">Your Rating</h4>
                      
                      <div className="flex flex-col gap-4">
                        {/* Watch Status Selector */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Watch Status</label>
                          <select
                            value={selectedMediaInfo.user_rating?.watch_status || 'not_watched'}
                            onChange={(e) => handleUpdateStatus(selectedMediaInfo.id, { watch_status: e.target.value })}
                            className={`w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!(list.is_owner || list.shared_with_me) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            disabled={!(list.is_owner || list.shared_with_me)}
                          >
                            <option value="not_watched">Not Watched</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        
                        {/* Rating Input */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">
                            Your Rating {selectedMediaInfo.user_rating?.rating ? `(${selectedMediaInfo.user_rating.rating}/10)` : ''}
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.1"
                              value={selectedMediaInfo.user_rating?.rating || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                                  handleUpdateStatus(selectedMediaInfo.id, { rating: value ? Number(value) : null });
                                }
                              }}
                              placeholder="1.0-10.0"
                              className={`w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                                ${selectedMediaInfo.user_rating?.watch_status !== 'completed' || !(list.is_owner || list.shared_with_me) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              disabled={!(list.is_owner || list.shared_with_me) || selectedMediaInfo.user_rating?.watch_status !== 'completed'}
                            />
                            {selectedMediaInfo.user_rating?.rating && (
                              <div className="flex">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                  <span 
                                    key={star} 
                                    className={`text-xl ${selectedMediaInfo.user_rating.rating >= star ? 'text-yellow-500' : 'text-gray-600'}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {selectedMediaInfo.user_rating?.watch_status !== 'completed' && (
                            <p className="text-sm text-gray-400 mt-1">
                              Mark as completed to rate this title
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* All Ratings from List Members */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-3">Ratings from List Members</h4>
                      {loadingRatings ? (
                        <div className="flex justify-center p-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                      ) : mediaRatings && mediaRatings.ratings && mediaRatings.ratings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {mediaRatings.ratings.map((rating, index) => (
                            <div key={index} className="bg-slate-700/30 p-3 rounded-lg flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300">{rating.user.username}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  rating.watch_status === 'completed' ? 'bg-green-500/30 text-green-300' :
                                  rating.watch_status === 'in_progress' ? 'bg-yellow-500/30 text-yellow-300' :
                                  'bg-gray-500/30 text-gray-300'
                                }`}>
                                  {rating.watch_status.replace('_', ' ')}
                                </span>
                              </div>
                              {rating.rating && (
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-400">★</span>
                                  <span className="font-medium">{rating.rating}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400">No ratings from list members yet.</p>
                      )}
                      
                      {/* Average Rating */}
                      {selectedMediaInfo.avg_rating && selectedMediaInfo.rating_count > 0 && (
                        <div className="mt-4 bg-purple-500/20 p-3 rounded-lg flex items-center justify-between">
                          <span className="text-purple-300">List Average</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-purple-300">{selectedMediaInfo.avg_rating.toFixed(1)}</span>
                            <span className="text-purple-400 text-sm">from {selectedMediaInfo.rating_count} {selectedMediaInfo.rating_count === 1 ? 'rating' : 'ratings'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Added Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Added By</h4>
                        <p className="text-gray-200">{selectedMediaInfo.added_by?.username || 'Unknown'}</p>
                      </div>
                      
                      {selectedMediaInfo.added_date && (
                        <div>
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">Added On</h4>
                          <p className="text-gray-200">{new Date(selectedMediaInfo.added_date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</p>
                        </div>
                      )}
                    </div>
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

export default ListDetails;