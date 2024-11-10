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

  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch all media items from each list
        const allMedia = [];
        let totalRating = 0;
        let ratedCount = 0;

        // Process media items and calculate ratings
        const processMediaItems = (mediaItems, listName, listId) => {
          const processedItems = mediaItems.map(item => ({
            ...item,
            listName,
            listId
          }));

          processedItems.forEach(item => {
            if (item.rating) {
              totalRating += item.rating;
              ratedCount++;
            }
          });

          return processedItems;
        };

        for (const list of lists) {
          const listResponse = await fetch(`${apiUrl}/api/lists/${list.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const processedMedia = processMediaItems(
              listData.media_items || [],
              list.name,
              list.id
            );
            allMedia.push(...processedMedia);
          }
        }

        setMediaItems(allMedia);

        // Calculate stats
        const completed = allMedia.filter(item => item.watch_status === 'completed').length;
        const inProgress = allMedia.filter(item => item.watch_status === 'in_progress').length;
        const notWatched = allMedia.filter(item => item.watch_status === 'not_watched').length;

        setStats({
          totalMedia: allMedia.length,
          completed,
          inProgress,
          notWatched,
          averageRating: ratedCount ? (totalRating / ratedCount).toFixed(1) : 0
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
    labels: ['Completed', 'In Progress', 'Not Watched'],
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

  const handleStatusUpdate = async (mediaId, listId, newStatus) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const updates = {
        watch_status: newStatus,
        rating: newStatus !== 'completed' ? null : undefined
      };
      
      const response = await fetch(`${apiUrl}/api/lists/${listId}/media/${mediaId}`, {
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
        let totalRating = 0;
        let ratedCount = 0;
        updatedMedia.forEach(item => {
          if (item.rating) {
            totalRating += item.rating;
            ratedCount++;
          }
        });

        // Update stats
        setStats(prev => ({
          ...prev,
          completed,
          inProgress,
          notWatched,
          averageRating: ratedCount ? (totalRating / ratedCount).toFixed(1) : 0
        }));

        return updatedMedia;
      });

    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.message);
    }
  };

  const handleRatingUpdate = async (mediaId, listId, newRating) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${listId}/media/${mediaId}`, {
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

      // Update local state without changing last_updated
      setMediaItems(prev => {
        const updatedItems = prev.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                rating: newRating ? Number(newRating) : null
              }
            : item
        );

        // Recalculate average rating
        let totalRating = 0;
        let ratedCount = 0;
        updatedItems.forEach(item => {
          if (item.rating) {
            totalRating += item.rating;
            ratedCount++;
          }
        });

        // Update stats
        setStats(prevStats => ({
          ...prevStats,
          averageRating: ratedCount ? (totalRating / ratedCount).toFixed(1) : 0
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

    // Sort by last_updated date and take the first 5
    return mediaWithDates
      .sort((a, b) => b.lastUpdatedDate - a.lastUpdatedDate)
      .slice(0, 3);
  };

  // Add these helper functions at the top with other functions
  const getTopRatedMedia = () => {
    if (!mediaItems) return [];
    
    return mediaItems
      .filter(item => item.rating) // Only items with personal ratings
      .sort((a, b) => b.rating - a.rating) // Sort by rating descending
      .slice(0, 5); // Take top 5
  };

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
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.listId}/media/${mediaId}`, {
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
          const allRatings = mediaItems
            .map(item => item.id === mediaId ? updates.rating : item.rating)
            .filter(rating => rating !== null && rating !== undefined);
          
          updatedStats.averageRating = allRatings.length 
            ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
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
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.listId}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete media');

      // Update local state
      setMediaItems(prevItems => prevItems.filter(item => item.id !== mediaId));
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error deleting media:', error);
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
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Welcome back <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">{user?.username}</span>
        </h1>
        <p className="text-gray-400">Your media tracking dashboard</p>
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
              <div className="flex items-start gap-4">
                {media.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                    alt={media.title}
                    className="w-16 h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-24 bg-slate-600 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-400">No poster</span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-semibold line-clamp-1">{media.title}</h4>
                  <p className="text-sm text-gray-400 mb-2">From: {media.listName}</p>
                  <select
                    className="w-full bg-slate-600 text-sm rounded px-2 py-1 mb-2"
                    value={media.watch_status}
                    onChange={(e) => handleStatusUpdate(media.id, media.listId, e.target.value)}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="not_watched">Not Started</option>
                    <option value="completed">Completed</option>
                  </select>
                  {media.watch_status === 'completed' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-yellow-500">⭐</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={media.rating || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (Number(value) >= 1 && Number(value) <= 10)) {
                            handleRatingUpdate(media.id, media.listId, value);
                          }
                        }}
                        placeholder="1.0-10.0"
                        className="bg-slate-600 text-sm rounded px-2 py-1 w-20"
                      />
                      <span className="text-sm text-gray-400">/10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredMedia.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400">
              No media items found with this status
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

      {/* Movie Roulette */}
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

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
      >
        <button
          onClick={() => navigate('/search')}
          className="p-4 bg-gradient-to-r from-sky-600/20 to-blue-600/20 rounded-lg border border-sky-500/30 hover:from-sky-600/30 hover:to-blue-600/30 transition-all duration-300"
        >
          <h3 className="text-lg font-semibold mb-2">Find Media</h3>
          <p className="text-sm text-gray-400">Search and discover new titles</p>
        </button>

        <button
          onClick={() => navigate('/lists')}
          className="p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg border border-purple-500/30 hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300"
        >
          <h3 className="text-lg font-semibold mb-2">Manage Lists</h3>
          <p className="text-sm text-gray-400">Create and organize your collections</p>
        </button>

        <button
          onClick={() => navigate('/lists/join')}
          className="p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg border border-green-500/30 hover:from-green-600/30 hover:to-emerald-600/30 transition-all duration-300"
        >
          <h3 className="text-lg font-semibold mb-2">Join Lists</h3>
          <p className="text-sm text-gray-400">Connect with friends' collections</p>
        </button>
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4">Watch Progress</h3>
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

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4">Recently Updated</h3>
          <div className="space-y-3">
            {getRecentlyUpdatedMedia().map(media => (
              <div
                key={media.id}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors duration-200"
                onClick={() => setSelectedMedia(media)}
              >
                <div className="flex items-center gap-3">
                  {media.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w45${media.poster_path}`}
                      alt={media.title}
                      className="w-8 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-8 h-12 bg-slate-600 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">No img</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium line-clamp-1">{media.title}</p>
                    <p className="text-sm text-gray-400">From: {media.listName}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-sm ${
                  media.watch_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  media.watch_status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {media.watch_status === 'completed' ? 'Completed' :
                   media.watch_status === 'in_progress' ? 'In Progress' :
                   'Not Started'}
                </span>
              </div>
            ))}
            {mediaItems.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No media items found
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
      </div>

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
                    From: {media.listName}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium text-green-400">{media.rating}</span>
                </div>
              </div>
            ))}
            {getTopRatedMedia().length === 0 && (
              <div className="text-center py-4 text-gray-400">
                No rated media yet
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/ratings', { state: { initialTab: 'highest' }})}
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
                    From: {media.listName}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium text-red-400">{media.rating}</span>
                </div>
              </div>
            ))}
            {getLowestRatedMedia().length === 0 && (
              <div className="text-center py-4 text-gray-400">
                No rated media yet
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/ratings', { state: { initialTab: 'lowest' }})}
            className="w-full text-center mt-4 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            View all-time ratings →
          </button>
        </motion.div>
      </div>

      {/* Media Management Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedMedia(null);
            }}
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
                  onClick={() => {
                    setSelectedMedia(null);
                  }}
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

export default Hub;