import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Hub = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalMedia: 0,
    completed: 0,
    inProgress: 0,
    notWatched: 0,
    averageRating: 0
  });
  const [selectedView, setSelectedView] = useState('in_progress');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Show 6 items per page
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset pagination when selectedView changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedView]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch user's media
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

        // Fetch feed
        const feedResponse = await fetch(`${apiUrl}/api/user/feed`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (feedResponse.ok) {
          const feedData = await feedResponse.json();
          setFeedItems(feedData.feed_items || []);
        }

        // Calculate stats from user media data
        const completed = userMediaData.media_items?.filter(item => item.watch_status === 'completed').length || 0;
        const inProgress = userMediaData.media_items?.filter(item => item.watch_status === 'in_progress').length || 0;
        const notWatched = userMediaData.media_items?.filter(item => item.watch_status === 'not_watched').length || 0;
        
        // Calculate average rating from completed items with ratings
        const ratedItems = userMediaData.media_items?.filter(item => 
          item.watch_status === 'completed' && item.rating != null
        ) || [];
        
        const averageRating = ratedItems.length > 0
          ? (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1)
          : 0;

        setStats({
          totalMedia: userMediaData.media_items?.length || 0,
          completed,
          inProgress,
          notWatched,
          averageRating
        });

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isStatusDropdownOpen && !event.target.closest('.status-dropdown')) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusDropdownOpen]);

  const chartData = {
    labels: ['Completed', 'In Progress', 'Not Started'],
    datasets: [{
      data: [stats.completed, stats.inProgress, stats.notWatched],
      backgroundColor: [
        'rgba(34, 197, 94, 0.6)',
        'rgba(59, 130, 246, 0.6)',
        'rgba(107, 114, 128, 0.6)'
      ],
      borderColor: [
        'rgb(34, 197, 94)',
        'rgb(59, 130, 246)',
        'rgb(107, 114, 128)'
      ],
      borderWidth: 1
    }]
  };

  const handleStatusUpdate = async (mediaId, newStatus) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const updates = {
        watch_status: newStatus,
        rating: newStatus !== 'completed' ? null : undefined
      };
      
      const response = await fetch(`${apiUrl}/api/user/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update local state
      setMediaItems(prev => {
        const updatedMedia = prev.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                watch_status: newStatus, 
                rating: newStatus !== 'completed' ? null : item.rating,
                last_updated: new Date().toISOString()
              }
            : item
        );

        // Calculate stats
        const completed = updatedMedia.filter(item => item.watch_status === 'completed').length;
        const inProgress = updatedMedia.filter(item => item.watch_status === 'in_progress').length;
        const notWatched = updatedMedia.filter(item => item.watch_status === 'not_watched').length;

        // Recalculate average rating
        const ratedItems = updatedMedia.filter(item => 
          item.watch_status === 'completed' && item.rating !== null
        );
        
        const averageRating = ratedItems.length 
          ? (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1)
          : 0;

        // Update stats
        setStats(prev => ({
          ...prev,
          completed,
          inProgress,
          notWatched,
          averageRating
        }));

        return updatedMedia;
      });

    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.message);
    }
  };

  const handleRatingUpdate = async (mediaId, newRating) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/user/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating ? Number(newRating) : null })
      });

      if (!response.ok) {
        throw new Error('Failed to update rating');
      }

      // Update local state
      setMediaItems(prev => {
        const updatedItems = prev.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                rating: newRating ? Number(newRating) : null,
                last_updated: new Date().toISOString()
              }
            : item
        );

        // Recalculate average rating
        const ratedItems = updatedItems.filter(item => 
          item.watch_status === 'completed' && item.rating !== null
        );
        
        const averageRating = ratedItems.length 
          ? (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1)
          : 0;

        // Update stats
        setStats(prevStats => ({
          ...prevStats,
          averageRating
        }));

        return updatedItems;
      });

    } catch (err) {
      console.error('Failed to update rating:', err);
      setError(err.message);
    }
  };

  const filteredMedia = mediaItems
    .filter(item => item.watch_status === selectedView)
    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredMedia.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);

  // Handle page changes
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to top of media section
    document.getElementById('media-section').scrollIntoView({ behavior: 'smooth' });
  };

  // Helper function to get status display text
  const getStatusDisplayText = (status) => {
    switch(status) {
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'not_watched': return 'Not Started';
      default: return 'In Progress';
    }
  };

  const getRecentlyUpdatedMedia = () => {
    // Create a copy with added dates as Date objects for proper sorting
    const mediaWithDates = mediaItems.map(item => ({
      ...item,
      lastUpdatedDate: new Date(item.last_updated)
    }));

    // Sort by last_updated date and take exactly 3 items
    return mediaWithDates
      .sort((a, b) => b.lastUpdatedDate - a.lastUpdatedDate)
      .slice(0, 3);
  };

  // Get top rated media from user's own ratings
  const getTopRatedMedia = () => {
    if (!mediaItems) return [];
    
    return mediaItems
      .filter(item => item.rating) // Only items with personal ratings
      .sort((a, b) => b.rating - a.rating) // Sort by rating descending
      .slice(0, 5); // Take top 5
  };

  // Get lowest rated media from user's own ratings
  const getLowestRatedMedia = () => {
    if (!mediaItems) return [];
    
    return mediaItems
      .filter(item => item.rating) // Only items with personal ratings
      .sort((a, b) => a.rating - b.rating) // Sort by rating ascending
      .slice(0, 5); // Take bottom 5
  };

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
      
      const response = await fetch(`${apiUrl}/api/user/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update media');
      }

      // Update local state
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                ...updates,
                last_updated: now, // Include the timestamp in local state
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

      // Update stats if necessary
      if (updates.watch_status || updates.rating) {
        const updatedStats = { ...stats };
        
        if (updates.watch_status) {
          // Decrement old status count
          if (selectedMedia.watch_status === 'completed') updatedStats.completed--;
          else if (selectedMedia.watch_status === 'in_progress') updatedStats.inProgress--;
          else updatedStats.notWatched--;

          // Increment new status count
          if (updates.watch_status === 'completed') updatedStats.completed++;
          else if (updates.watch_status === 'in_progress') updatedStats.inProgress++;
          else updatedStats.notWatched++;
        }

        if (updates.rating !== undefined) {
          // Recalculate average rating
          const ratedItems = mediaItems
            .filter(item => item.id !== mediaId || updates.rating !== null)
            .map(item => item.id === mediaId ? updates.rating : item.rating)
            .filter(rating => rating !== null && rating !== undefined);
          
          updatedStats.averageRating = ratedItems.length 
            ? (ratedItems.reduce((a, b) => a + b, 0) / ratedItems.length).toFixed(1)
            : 0;
        }

        setStats(updatedStats);
      }
    } catch (error) {
      console.error('Error updating media:', error);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/user/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete media');
      }

      // Update local state
      setMediaItems(prevItems => {
        const updatedItems = prevItems.filter(item => item.id !== mediaId);
        
        // Calculate new stats after removal
        const completed = updatedItems.filter(item => item.watch_status === 'completed').length;
        const inProgress = updatedItems.filter(item => item.watch_status === 'in_progress').length;
        const notWatched = updatedItems.filter(item => item.watch_status === 'not_watched').length;
        
        // Calculate new average rating
        const ratedItems = updatedItems.filter(item => 
          item.watch_status === 'completed' && item.rating !== null
        );
        
        const averageRating = ratedItems.length 
          ? (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1)
          : 0;

        // Update stats
        setStats({
          totalMedia: updatedItems.length,
          completed,
          inProgress,
          notWatched,
          averageRating
        });

        return updatedItems;
      });

      setSelectedMedia(null);
      setShowDeleteConfirm(false);

    } catch (error) {
      console.error('Error deleting media:', error);
      setError('Failed to delete media');
    }
  };

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedMedia]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <h3 className="text-red-500 font-semibold">Error loading dashboard</h3>
        <p className="text-red-400">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold mb-2">
          Welcome back <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">{user?.username}</span>
        </h1>
        <p className="text-gray-400">Your media tracking dashboard</p>
      </motion.div>

      {/* Movie Roulette - Moved to top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <button
          onClick={() => navigate('/roulette')}
          className="w-full bg-gradient-to-r from-rose-500/30 to-orange-500/30 hover:from-rose-500/40 hover:to-orange-500/40 p-6 rounded-lg border border-rose-500/30 transition-all duration-300 transform hover:scale-[1.01] group"
        >
          <div className="flex items-center justify-center gap-4">
            <svg 
              className="w-8 h-8 text-rose-400 animate-spin-slow group-hover:animate-spin" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" 
              />
            </svg>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-rose-400 group-hover:text-rose-300">Movie Roulette</h2>
              <p className="text-gray-400">Can't decide what to watch? Give the roulette wheel a whirl!</p>
            </div>
          </div>
        </button>
      </motion.div>

      {/* Statistics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Total Films & TV Shows</h3>
          <p className="text-2xl font-bold">{stats.totalMedia}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Completed</h3>
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">In Progress</h3>
          <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Average Rating</h3>
          <p className="text-2xl font-bold text-yellow-500">⭐ {stats.averageRating}</p>
        </div>
      </motion.div>

      {/* Watch Progress (Full Width) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 mb-8"
      >
        <h3 className="text-xl font-semibold mb-6">Watch Progress</h3>
        <div className="h-64">
          {stats.totalMedia > 0 ? (
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                }
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-center">No watch progress yet</p>
              <p className="text-sm text-gray-500 mt-2">Add media to your lists to track progress</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Activity Updates - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Updates (User's own updates) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4">Your Recent Activity</h3>
          <div className="space-y-4">
            {getRecentlyUpdatedMedia().map((media, index) => (
              <motion.div
                key={media.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-r from-slate-700/40 to-slate-700/20 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] border border-slate-600/50"
                onClick={() => setSelectedMedia(media)}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-indigo-500/30 rounded-full flex items-center justify-center text-indigo-300 font-semibold">
                      {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-indigo-400">{user?.username}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        {media.watch_status === 'completed' ? 'completed watching' :
                         media.watch_status === 'in_progress' ? 'started watching' :
                         'added to watchlist'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    {media.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                        alt={media.title}
                        className="w-12 h-18 object-cover rounded-md shadow-md transform transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="w-12 h-18 bg-slate-600 rounded-md shadow-md flex items-center justify-center">
                        <span className="text-xs text-gray-400">No img</span>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-white hover:text-indigo-300 transition-colors duration-200">{media.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-indigo-500/20 rounded-full text-indigo-300">{media.list_name}</span>
                        {media.media_type && (
                          <span className="text-xs px-2 py-1 bg-purple-500/20 rounded-full text-purple-300">{media.media_type}</span>
                        )}
                      </div>
                      
                      {media.rating && (
                        <div className="mt-2 flex items-center">
                          <div className="flex items-center bg-yellow-500/10 px-2 py-1 rounded-md">
                            <span className="text-yellow-500 mr-1">★</span>
                            <span className="text-yellow-400 font-medium">{media.rating}</span>
                            <span className="text-yellow-600 text-xs">/10</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                          {new Date(media.last_updated).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        
                        <div className="text-xs text-gray-400 flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                            media.watch_status === 'completed' ? 'bg-green-500' : 
                            media.watch_status === 'in_progress' ? 'bg-blue-500' : 
                            'bg-purple-500'
                          }`}></span>
                          <span>{
                            media.watch_status === 'completed' ? 'Completed' : 
                            media.watch_status === 'in_progress' ? 'In Progress' : 
                            'Not Started'
                          }</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {mediaItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center">No media items found</p>
                <p className="text-sm text-gray-500 mt-2">Add media to your lists to see updates here</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/history')}
            className="w-full text-center mt-4 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            View full history →
          </button>
        </motion.div>

        {/* Feed (Recent updates in user's lists) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4">Recent Collaborator Activity</h3>
          <div className="space-y-4">
            {feedItems.slice(0, 3).map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-r from-slate-700/40 to-slate-700/20 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] border border-slate-600/50"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-blue-500/30 rounded-full flex items-center justify-center text-blue-300 font-semibold">
                      {item.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-blue-400">{item.user_name}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        {item.action}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                        alt={item.media_title}
                        className="w-12 h-18 object-cover rounded-md shadow-md transform transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="w-12 h-18 bg-slate-600 rounded-md shadow-md flex items-center justify-center">
                        <span className="text-xs text-gray-400">No img</span>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-white hover:text-blue-300 transition-colors duration-200">{item.media_title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-indigo-500/20 rounded-full text-indigo-300">{item.list_name}</span>
                        {item.media_type && (
                          <span className="text-xs px-2 py-1 bg-purple-500/20 rounded-full text-purple-300">{item.media_type}</span>
                        )}
                      </div>
                      
                      {item.rating && (
                        <div className="mt-2 flex items-center">
                          <div className="flex items-center bg-yellow-500/10 px-2 py-1 rounded-md">
                            <span className="text-yellow-500 mr-1">★</span>
                            <span className="text-yellow-400 font-medium">{item.rating}</span>
                            <span className="text-yellow-600 text-xs">/10</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        
                        <div className="text-xs text-gray-400 flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                            item.action.includes('watched') ? 'bg-green-500' : 
                            item.action.includes('added') ? 'bg-blue-500' : 
                            item.action.includes('rated') ? 'bg-yellow-500' : 'bg-purple-500'
                          }`}></span>
                          <span>{
                            item.action.includes('watched') ? 'Watched' : 
                            item.action.includes('added') ? 'Added' : 
                            item.action.includes('rated') ? 'Rated' : 'Updated'
                          }</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {feedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-center">No activity to show</p>
                <p className="text-sm text-gray-500 mt-2">Join lists with others to see their activity</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Media Status Section */}
      <motion.div
        id="media-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 mb-8"
      >
        <div className="relative mb-6 status-dropdown">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">Media Status:</h3>
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
            >
              <span className={
                selectedView === 'in_progress' ? 'text-blue-500' :
                selectedView === 'completed' ? 'text-green-500' :
                'text-gray-500'
              }>
                {getStatusDisplayText(selectedView)}
              </span>
              <ChevronDownIcon 
                className={`w-5 h-5 transition-transform duration-200 ${
                  isStatusDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Dropdown Menu */}
          {isStatusDropdownOpen && (
            <div className="absolute z-10 mt-2 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-lg">
              <button
                onClick={() => {
                  setSelectedView('in_progress');
                  setIsStatusDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 text-blue-500 first:rounded-t-lg"
              >
                In Progress
              </button>
              <button
                onClick={() => {
                  setSelectedView('not_watched');
                  setIsStatusDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 text-gray-500"
              >
                Not Started
              </button>
              <button
                onClick={() => {
                  setSelectedView('completed');
                  setIsStatusDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 text-green-500 last:rounded-b-lg"
              >
                Completed
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map(media => (
            <div
              key={media.id}
              className="bg-slate-700/30 p-4 rounded-lg"
            >
              <div 
                className="flex items-start gap-4"
                onClick={(e) => {
                  // Prevent opening modal if clicking on the select dropdown or input
                  const target = e.target;
                  if (
                    target.tagName === 'SELECT' || 
                    target.tagName === 'OPTION' || 
                    target.tagName === 'INPUT' ||
                    target.closest('select') ||
                    target.closest('input')
                  ) {
                    return;
                  }
                  setSelectedMedia(media);
                }}
                style={{ cursor: 'pointer' }}
              >
                {media.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                    alt={media.title}
                    className="w-16 h-24 object-cover rounded"
                  />
                ) : (
                  <div 
                    className="w-16 h-24 bg-slate-600 rounded flex items-center justify-center"
                  >
                    <span className="text-xs text-gray-400">No poster</span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 
                    className="font-semibold line-clamp-1 hover:text-blue-400"
                  >{media.title}</h4>
                  <p className="text-sm text-gray-400 mb-2">In: {media.list_name}</p>
                  
                  {/* Stop propagation on select to prevent modal from opening */}
                  <select
                    className="w-full bg-slate-600 text-sm rounded px-2 py-1 mb-2"
                    value={media.watch_status}
                    onChange={(e) => handleStatusUpdate(media.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="not_watched">Not Started</option>
                    <option value="completed">Completed</option>
                  </select>
                  {media.watch_status === 'completed' && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-yellow-500">⭐</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={media.rating || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                            handleRatingUpdate(media.id, value);
                          }
                        }}
                        placeholder="1.0-10.0"
                        className="bg-slate-600 text-sm rounded px-2 py-1 w-20"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-gray-400">/10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredMedia.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-400">
                No media items found with {getStatusDisplayText(selectedView).toLowerCase()} status
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredMedia.length > itemsPerPage && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-lg ${
                currentPage === 1
                  ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              Previous
            </button>
            
            {/* Page numbers - Desktop */}
            <div className="hidden md:flex items-center gap-1">
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index + 1}
                  onClick={() => handlePageChange(index + 1)}
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

            {/* Page indicator - Mobile */}
            <div className="md:hidden flex items-center gap-1">
              <span className="text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-lg ${
                currentPage === totalPages
                  ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </motion.div>

      {/* Ratings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Rated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4 text-green-400">Your Top Rated</h3>
          <div className="space-y-3">
            {getTopRatedMedia().map(media => (
              <div
                key={media.id}
                className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors duration-200"
                onClick={() => setSelectedMedia(media)}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w45${media.poster_path}`}
                  alt={media.title}
                  className="w-8 h-12 object-cover rounded"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/45x68?text=No+Image';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-1">
                    {media.title || media.name}
                  </p>
                  <p className="text-sm text-gray-400 line-clamp-1">
                    In: {media.list_name}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium text-green-400">{media.rating}</span>
                </div>
              </div>
            ))}
            {getTopRatedMedia().length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center">No rated media yet</p>
                <p className="text-sm text-gray-500 mt-2">Complete watching media to rate it</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/rankings', { state: { initialTab: 'highest' }})}
            className="w-full text-center mt-4 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            View all-time ratings →
          </button>
        </motion.div>

        {/* Lowest Rated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4 text-red-400">Your Lowest Rated</h3>
          <div className="space-y-3">
            {getLowestRatedMedia().map(media => (
              <div
                key={media.id}
                className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors duration-200"
                onClick={() => setSelectedMedia(media)}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w45${media.poster_path}`}
                  alt={media.title}
                  className="w-8 h-12 object-cover rounded"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/45x68?text=No+Image';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-1">
                    {media.title || media.name}
                  </p>
                  <p className="text-sm text-gray-400 line-clamp-1">
                    In: {media.list_name}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium text-red-400">{media.rating}</span>
                </div>
              </div>
            ))}
            {getLowestRatedMedia().length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center">No rated media yet</p>
                <p className="text-sm text-gray-500 mt-2">Complete watching media to rate it</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/rankings', { state: { initialTab: 'lowest' }})}
            className="w-full text-center mt-4 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            View all-time ratings →
          </button>
        </motion.div>
      </div>

      {/* Media Information Modal */}
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

                    {/* Overview - Now first */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Overview</h4>
                      <p className="text-gray-300 leading-relaxed">
                        {selectedMedia.overview || 'No overview available.'}
                      </p>
                    </div>

                    {/* Status - Now second */}
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

                    {/* Rating - Now third */}
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
                        <p className="text-gray-200">{selectedMedia.list_name}</p>
                        <button
                          onClick={() => navigate(`/lists/${selectedMedia.list_id}`)}
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
                        className="w-full bg-red-500/20 text-red-500 hover:bg-red-500/30 px-4 py-2 rounded-lg mt-4 transition-colors duration-200"
                      >
                        Remove from List
                      </button>
                    ) : (
                      <div className="border border-red-500/50 rounded-lg p-4 mt-4 bg-red-500/10">
                        <p className="text-center text-sm text-red-400 mb-3">
                          Are you sure you want to remove this from your list?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteMedia(selectedMedia.id)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors duration-200"
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

export default Hub;