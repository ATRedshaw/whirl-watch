import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  const [lists, setLists] = useState([]);
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
        setLists(lists);

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
      
      // Create update object with both status and rating
      const updates = {
        watch_status: newStatus,
        rating: newStatus !== 'completed' ? null : undefined // Set rating to null if not completed
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
            ? { ...item, watch_status: newStatus, rating: newStatus !== 'completed' ? null : item.rating }
            : item
        );

        // Recalculate average rating
        let totalRating = 0;
        let ratedCount = 0;
        updatedMedia.forEach(item => {
          if (item.rating) {
            totalRating += item.rating;
            ratedCount++;
          }
        });

        // Calculate other stats
        const completed = updatedMedia.filter(item => item.watch_status === 'completed').length;
        const inProgress = updatedMedia.filter(item => item.watch_status === 'in_progress').length;
        const notWatched = updatedMedia.filter(item => item.watch_status === 'not_watched').length;

        // Update all stats including average rating
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

      // Update local state
      setMediaItems(prev => {
        const updatedItems = prev.map(item => 
          item.id === mediaId 
            ? { ...item, rating: newRating ? Number(newRating) : null }
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

        // Update stats with new average
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

  const filteredMedia = mediaItems.filter(item => item.watch_status === selectedView);

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
          Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">{user?.username}</span>
        </h1>
        <p className="text-gray-400">Your media tracking dashboard</p>
      </motion.div>

      {/* Media Status Section */}
      <motion.div
        id="media-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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
              <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
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
                  setSelectedView('completed');
                  setIsStatusDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 text-green-500"
              >
                Completed
              </button>
              <button
                onClick={() => {
                  setSelectedView('not_watched');
                  setIsStatusDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 text-gray-500 last:rounded-b-lg"
              >
                Not Started
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
                    <option value="not_watched">Not Started</option>
                    <option value="in_progress">In Progress</option>
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
                        placeholder="1-10"
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

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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

      {/* Statistics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Total Media</h3>
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
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-4">Recent Lists</h3>
          <div className="space-y-3">
            {lists.slice(0, 5).map(list => (
              <div
                key={list.id}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <span>{list.name}</span>
                <span className="text-sm text-gray-400">
                  {list.is_owner ? 'Owner' : 'Shared'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Hub;