import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ListDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      // Update local state
      setList(prevList => ({
        ...prevList,
        media_items: prevList.media_items.map(item =>
          item.id === mediaId ? { ...item, ...updates } : item
        )
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Are you sure you want to remove this item from the list?')) {
      return;
    }

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

      // Update local state to remove the deleted item
      setList(prevList => ({
        ...prevList,
        media_items: prevList.media_items.filter(item => item.id !== mediaId)
      }));
    } catch (err) {
      setError(err.message);
    }
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
          </div>
          <p className="text-gray-400">{list.description || 'No description'}</p>
        </motion.div>

        {/* Empty State Message */}
        {(!list.media_items || list.media_items.length === 0) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">This list is empty</h3>
              <p className="text-gray-500">Start adding movies and TV shows to build your collection!</p>
            </div>
          </motion.div>
        ) : (
          /* Media Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {list.media_items.map(media => (
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
                  {/* Delete Button */}
                  {list.is_owner && (
                    <button
                      onClick={() => handleDeleteMedia(media.id)}
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

                  {/* Watch Status */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">Watch Status</label>
                    <select
                      value={media.watch_status}
                      onChange={(e) => handleUpdateStatus(media.id, { watch_status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!list.is_owner}
                    >
                      <option value="not_watched">Not Watched</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Rating</label>
                    <select
                      value={media.rating || ''}
                      onChange={(e) => handleUpdateStatus(media.id, { rating: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!list.is_owner}
                    >
                      <option value="">Not Rated</option>
                      {[1, 2, 3, 4, 5].map(rating => (
                        <option key={rating} value={rating}>{rating} Star{rating !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListDetails;