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
  const [selfFeedItems, setSelfFeedItems] = useState([]);
  const [collaboratorFeedItems, setCollaboratorFeedItems] = useState([]);
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

        // Fetch self feed (things I've done)
        const selfFeedResponse = await fetch(`${apiUrl}/api/feed/self`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (selfFeedResponse.ok) {
          const selfFeedData = await selfFeedResponse.json();
          setSelfFeedItems(selfFeedData.feed_items || []);
        }

        // Fetch collaborator feed (things my teammates did)
        const collaboratorFeedResponse = await fetch(`${apiUrl}/api/feed/collaborators`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (collaboratorFeedResponse.ok) {
          const collaboratorFeedData = await collaboratorFeedResponse.json();
          setCollaboratorFeedItems(collaboratorFeedData.feed_items || []);
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

  // Function to fetch updated feed data
  const fetchFeedData = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');

      // Fetch self feed (things I've done)
      const selfFeedResponse = await fetch(`${apiUrl}/api/feed/self`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (selfFeedResponse.ok) {
        const selfFeedData = await selfFeedResponse.json();
        setSelfFeedItems(selfFeedData.feed_items || []);
      }

      // Fetch collaborator feed (things my teammates did)
      const collaboratorFeedResponse = await fetch(`${apiUrl}/api/feed/collaborators`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (collaboratorFeedResponse.ok) {
        const collaboratorFeedData = await collaboratorFeedResponse.json();
        setCollaboratorFeedItems(collaboratorFeedData.feed_items || []);
      }
    } catch (err) {
      console.error('Error fetching feed data:', err);
    }
  };

  // Function to refresh all media and update stats
  const refreshMediaAndStats = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Fetch fresh media data
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
      const updatedMedia = userMediaData.media_items || [];
      
      // Update media items state
      setMediaItems(updatedMedia);
      
      // Recalculate all stats with fresh data
      const completed = updatedMedia.filter(item => item.watch_status === 'completed').length;
      const inProgress = updatedMedia.filter(item => item.watch_status === 'in_progress').length;
      const notWatched = updatedMedia.filter(item => item.watch_status === 'not_watched').length;
      
      // Calculate average rating from completed items with ratings
      const ratedItems = updatedMedia.filter(item => 
        item.watch_status === 'completed' && item.rating != null
      );
      
      const averageRating = ratedItems.length > 0
        ? (ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length).toFixed(1)
        : 0;

      // Update stats with fresh data
      setStats({
        totalMedia: updatedMedia.length,
        completed,
        inProgress,
        notWatched,
        averageRating
      });

      // Also refresh the feed data
      await fetchFeedData();

      // If there's a selected media, update it with fresh data
      if (selectedMedia) {
        const updatedSelectedMedia = updatedMedia.find(item => item.id === selectedMedia.id);
        if (updatedSelectedMedia) {
          setSelectedMedia(updatedSelectedMedia);
        }
      }
      
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

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
      
      // Find the media item to get its list_id
      const mediaItem = mediaItems.find(item => item.id === mediaId);
      if (!mediaItem) {
        throw new Error('Media item not found');
      }
      
      const updates = {
        watch_status: newStatus,
        rating: newStatus !== 'completed' ? null : mediaItem.rating,
        last_updated: new Date().toISOString()
      };
      
      const response = await fetch(`${apiUrl}/api/lists/${mediaItem.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      // Refresh all data to ensure the entire UI updates
      await refreshMediaAndStats();

    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.message);
      
      // Clear error after 3 seconds for better UX
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRatingUpdate = async (mediaId, newRating) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Find the media item to get its list_id
      const mediaItem = mediaItems.find(item => item.id === mediaId);
      if (!mediaItem) {
        throw new Error('Media item not found');
      }
      
      // Updated API endpoint pattern matching ListDetails.js
      const response = await fetch(`${apiUrl}/api/lists/${mediaItem.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rating: newRating ? Number(newRating) : null,
          last_updated: new Date().toISOString()
        })
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
                last_updated: new Date().toISOString(),
                lastUpdatedDate: new Date() // Add for sorting purposes
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

      // If the selected media is the one being updated, update it as well
      if (selectedMedia && selectedMedia.id === mediaId) {
        setSelectedMedia(prev => ({
          ...prev,
          rating: newRating ? Number(newRating) : null,
          last_updated: new Date().toISOString(),
          lastUpdatedDate: new Date()
        }));
      }

    } catch (err) {
      console.error('Failed to update rating:', err);
      setError(err.message);
    }
  };

  // Function to find user's copy of a collaborator's media item
  const findUserMediaForCollaboratorItem = (feedItem) => {
    if (!feedItem || !mediaItems.length) return null;
    
    // First try to find by exact tmdb_id match
    const matchByTmdbId = mediaItems.find(item => 
      item.tmdb_id === feedItem.tmdb_id
    );
    
    if (matchByTmdbId) return matchByTmdbId;
    
    // Fallback to title match if no TMDB ID match found
    return mediaItems.find(item => 
      item.title?.toLowerCase() === feedItem.media_title?.toLowerCase()
    );
  };

  // Handler for when a collaborator feed item is clicked
  const handleCollaboratorItemClick = (feedItem) => {
    // Try to find the user's copy of this media
    const userMedia = findUserMediaForCollaboratorItem(feedItem);
    
    if (userMedia) {
      // If user has this media in their collection, show their version
      setSelectedMedia(userMedia);
    } else {
      // Create a simplified media object with the feed item data if user doesn't have it
      const simplifiedMedia = {
        title: feedItem.media_title,
        media_type: feedItem.media_type,
        poster_path: feedItem.poster_path,
        tmdb_id: feedItem.tmdb_id,
        overview: feedItem.overview || "No overview available.",
        vote_average: feedItem.vote_average,
        // Include default values for required fields
        watch_status: 'not_watched',
        in_user_collection: false
      };
      
      setSelectedMedia(simplifiedMedia);
    }
  };

  const filteredMedia = mediaItems
    .filter(item => item.watch_status === selectedView)
    // Use a Set to track unique TMDB IDs and avoid duplicates
    .filter((item, index, self) => {
      const firstIndex = self.findIndex(m => m.tmdb_id === item.tmdb_id);
      return firstIndex === index; // Keep only the first occurrence of each tmdb_id
    })
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

// eslint-disable-next-line no-unused-vars
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
    
    // Create a map to track unique TMDB IDs
    const uniqueMediaMap = new Map();
    
    mediaItems
      .filter(item => item.rating) // Only items with personal ratings
      .sort((a, b) => b.rating - a.rating) // Sort by rating descending
      .forEach(item => {
        // Only add to the map if this TMDB ID isn't already there
        if (!uniqueMediaMap.has(item.tmdb_id)) {
          uniqueMediaMap.set(item.tmdb_id, item);
        }
      });
    
    // Convert map values back to array and take top 5
    return Array.from(uniqueMediaMap.values()).slice(0, 5);
  };

  // Get lowest rated media from user's own ratings
  const getLowestRatedMedia = () => {
    if (!mediaItems) return [];
    
    // Create a map to track unique TMDB IDs
    const uniqueMediaMap = new Map();
    
    mediaItems
      .filter(item => item.rating) // Only items with personal ratings
      .sort((a, b) => a.rating - b.rating) // Sort by rating ascending
      .forEach(item => {
        // Only add to the map if this TMDB ID isn't already there
        if (!uniqueMediaMap.has(item.tmdb_id)) {
          uniqueMediaMap.set(item.tmdb_id, item);
        }
      });
    
    // Convert map values back to array and take bottom 5
    return Array.from(uniqueMediaMap.values()).slice(0, 5);
  };

  const handleUpdateStatus = async (mediaId, updates) => {
    try {
      if (!selectedMedia && !mediaId) return;
      
      // Get the media item
      const mediaItem = mediaItems.find(item => item.id === mediaId);
      if (!mediaItem) {
        throw new Error('Media item not found');
      }

      // If changing to non-completed status, clear rating
      if (updates.watch_status && updates.watch_status !== 'completed') {
        updates.rating = null;
      }

      // Add last_updated timestamp
      const now = new Date().toISOString();
      updates.last_updated = now;

      // Update local state IMMEDIATELY for instant UI feedback before API call
      // 1. Update media items
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === mediaId 
            ? { 
                ...item, 
                ...updates,
                last_updated: now,
                lastUpdatedDate: new Date(now)
              }
            : item
        )
      );

      // 2. Update selected media if it matches
      if (selectedMedia && selectedMedia.id === mediaId) {
        setSelectedMedia(prev => ({
          ...prev,
          ...updates,
          last_updated: now,
          lastUpdatedDate: new Date(now)
        }));
      }

      // 3. Update stats immediately based on the new state
      const updatedItems = mediaItems.map(item => 
        item.id === mediaId 
          ? { 
              ...item, 
              ...updates,
              last_updated: now
            }
          : item
      );
      
      // Calculate new stats
      const completed = updatedItems.filter(item => 
        updates.watch_status && item.id === mediaId 
          ? updates.watch_status === 'completed' 
          : item.watch_status === 'completed'
      ).length;
      
      const inProgress = updatedItems.filter(item => 
        updates.watch_status && item.id === mediaId 
          ? updates.watch_status === 'in_progress' 
          : item.watch_status === 'in_progress'
      ).length;
      
      const notWatched = updatedItems.filter(item => 
        updates.watch_status && item.id === mediaId 
          ? updates.watch_status === 'not_watched' 
          : item.watch_status === 'not_watched'
      ).length;
      
      // Calculate new average rating
      const ratedItems = updatedItems.filter(item => {
        if (item.id === mediaId && updates.rating !== undefined) {
          return updates.watch_status === 'completed' && updates.rating !== null && updates.rating !== undefined;
        }
        return item.watch_status === 'completed' && item.rating !== null && item.rating !== undefined;
      });
      
      const averageRating = ratedItems.length 
        ? (ratedItems.reduce((sum, item) => {
            if (item.id === mediaId && updates.rating !== undefined) {
              return sum + (updates.rating || 0);
            }
            return sum + (item.rating || 0);
          }, 0) / ratedItems.length).toFixed(1)
        : 0;

      // Update stats
      setStats({
        totalMedia: updatedItems.length,
        completed,
        inProgress,
        notWatched,
        averageRating
      });

      // Make the API call in the background
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${mediaItem.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      // Refresh feed data after successful API call
      fetchFeedData();

    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.message);
      
      // Clear error after 3 seconds for better UX
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Updated API endpoint pattern matching ListDetails.js
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
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
          <h3 className="text-gray-400 text-sm mb-1">Your Average Rating</h3>
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
            {selfFeedItems.slice(0, 3).map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-r from-slate-700/40 to-slate-700/20 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] border border-slate-600/50"
                onClick={() => {
                  const userMedia = findUserMediaForCollaboratorItem(item);
                  setSelectedMedia(userMedia || item);
                }}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-indigo-500/30 rounded-full flex items-center justify-center text-indigo-300 font-semibold">
                      {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-indigo-400">You</span>
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
                      <h4 className="font-semibold text-white hover:text-indigo-300 transition-colors duration-200">{item.media_title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-indigo-500/20 rounded-full text-indigo-300">{item.list_name}</span>
                        {item.media_type && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 rounded-full text-xs font-medium text-blue-300 uppercase">
                            {item.media_type}
                          </span>
                        )}
                      </div>
                      
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
                            item.watch_status === 'completed' ? 'bg-green-500' : 
                            item.watch_status === 'in_progress' ? 'bg-blue-500' : 
                            'bg-purple-500'
                          }`}></span>
                          <span>{
                            item.watch_status === 'completed' ? 'Completed' : 
                            item.watch_status === 'in_progress' ? 'In Progress' : 
                            'Not Started'
                          }</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {selfFeedItems.length === 0 && (
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
          <h3 className="text-xl font-semibold mb-4">Recent Activity in Shared Lists</h3>
          <div className="space-y-4">
            {collaboratorFeedItems.slice(0, 3).map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-r from-slate-700/40 to-slate-700/20 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] border border-slate-600/50 cursor-pointer"
                onClick={() => handleCollaboratorItemClick(item)}
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
                          <span className="text-xs px-2 py-1 bg-blue-500/20 rounded-full text-xs font-medium text-blue-300 uppercase">
                            {item.media_type}
                          </span>
                        )}
                      </div>
                      
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
                            item.action.includes('completed') || item.action.includes('watched') ? 'bg-green-500' : 
                            item.action.includes('started') || item.action.includes('progress') ? 'bg-blue-500' : 
                            'bg-purple-500'
                          }`}></span>
                          <span>{
                            item.action.includes('completed') || item.action.includes('watched') ? 'Completed' : 
                            item.action.includes('started') || item.action.includes('progress') ? 'In Progress' : 
                            'Not Started'
                          }</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {collaboratorFeedItems.length === 0 && (
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
              className="bg-gradient-to-br from-slate-700/50 to-slate-700/30 p-4 rounded-lg border border-slate-600/50 hover:border-slate-500/70 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.01]"
            >
              <div 
                className="flex gap-3"
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
                {/* Left side - Poster with overlay for media type badge only */}
                <div className="relative w-20 flex-shrink-0">
                  {media.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                      alt={media.title}
                      className="w-20 h-30 object-cover rounded-md shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-30 bg-slate-600 rounded-md shadow-md flex items-center justify-center">
                      <span className="text-xs text-gray-400">No poster</span>
                    </div>
                  )}
                  
                  {/* Media type badge */}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-slate-900/80 text-xs rounded text-blue-300 font-semibold">
                    {media.media_type === 'movie' ? 'MOVIE' : 'TV'}
                  </div>
                </div>
                
                {/* Right side - Content */}
                <div className="flex-1 flex flex-col">
                  {/* Title with truncate */}
                  <h4 className="font-semibold text-white text-md line-clamp-1 mb-1.5 hover:text-blue-400 transition-colors">
                    {media.title}
                  </h4>
                  
                  {/* TMDB rating if available */}
                  {media.vote_average && (
                    <div className="flex items-center mb-1.5 text-xs text-gray-400">
                      <svg className="w-3.5 h-3.5 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{media.vote_average.toFixed(1)} (TMDB)</span>
                    </div>
                  )}
                  
                  {/* Status dropdown with stylized look */}
                  <div className="mt-auto">
                    <div className="mb-2">
                      <label className="text-xs text-blue-400 font-medium mb-1 block">Status</label>
                      <select
                        className="w-full bg-slate-800 text-sm rounded-md px-3 py-1 border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all"
                        value={media.watch_status}
                        onChange={(e) => handleStatusUpdate(media.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="not_watched">Not Started</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    
                    {/* Rating section, conditionally displayed */}
                    {media.watch_status === 'completed' && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs text-blue-400 font-medium mb-1 block">Your Rating</label>
                        <div className="flex items-center">
                          <span className="text-yellow-500 mr-1">⭐</span>
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
                            className="bg-slate-800 text-sm rounded-md px-3 py-1 w-20 border border-slate-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all"
                          />
                          <span className="text-sm text-gray-400 ml-1">/10</span>
                        </div>
                      </div>
                    )}
                  </div>
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
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{(media.release_date || media.first_air_date)?.split('-')[0]}</span>
                    {media.vote_average && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {media.vote_average?.toFixed(1)} (TMDB)
                      </span>
                    )}
                  </div>
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
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{(media.release_date || media.first_air_date)?.split('-')[0]}</span>
                    {media.vote_average && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {media.vote_average?.toFixed(1)} (TMDB)
                      </span>
                    )}
                  </div>
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

      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
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
                    {/* === START: Copied Header from ListDetails.js === */}
                    <h2 className="text-2xl font-bold mb-2">
                      {selectedMedia.title || selectedMedia.name}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                      {/* Handle release year */}
                      {(selectedMedia.release_date || selectedMedia.first_air_date) && (
                        <span>{(selectedMedia.release_date || selectedMedia.first_air_date).split('-')[0]}</span>
                      )}
                      
                      {/* Handle TMDB rating */}
                      {selectedMedia.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {selectedMedia.vote_average.toFixed(1)} {selectedMedia.vote_average ? "(TMDB)" : ""}
                        </span>
                      )}
                      
                      {/* Media type badge */}
                      <span className="px-2 py-1 bg-blue-500/20 rounded text-xs font-medium text-blue-300 uppercase">
                        {selectedMedia.media_type}
                      </span>
                    </div>
                    {/* === END: Copied Header from ListDetails.js === */}

                    {/* Overview - Now first */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Overview</h4>
                      <p className="text-gray-300 leading-relaxed">
                        {selectedMedia.overview || 'No overview available.'}
                      </p>
                    </div>

                    {/* Status - Now second */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Your Watch Status</h4>
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

                    {/* List Information - Now showing all lists containing this media */}
                    <div className="mb-5">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">List Information</h4>
                      {mediaItems
                        .filter(item => item.tmdb_id === selectedMedia.tmdb_id)
                        .map(item => (
                          <div key={item.list_id} className="flex items-center justify-between mb-2 p-2 bg-slate-700/30 rounded">
                            <p className="text-gray-200">{item.list_name}</p>
                            <button
                              onClick={() => navigate(`/lists/${item.list_id}`)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
                            >
                              Manage List
                            </button>
                          </div>
                        ))
                      }
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

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default Hub;