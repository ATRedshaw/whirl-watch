import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Rankings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'highest');
  const [mediaItems, setMediaItems] = useState(location.state?.mediaItems || []);
  // Only show loading when we have no preloaded data and need to fetch
  const [loading, setLoading] = useState(!location.state?.mediaItems);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(location.state?.initialList || 'all');
  const [listName, setListName] = useState(location.state?.listName || '');
  const [ratingMode, setRatingMode] = useState(location.state?.initialRatingMode || (location.state?.initialList ? 'list_average' : 'personal'));
  const [filters, setFilters] = useState({
    mediaType: 'all'
  });
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mediaRatings, setMediaRatings] = useState(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  
  // Single source of truth for all navigation/initialization state tracking
  const initialStateRef = useRef({
    // Track if this is a navigation with preloaded data
    hasPreloadedData: !!location.state?.mediaItems,
    // Track if we're coming from ListDetails with a specific list
    isFromListDetails: !!location.state?.skipInitialFetch,
    // Track list ID we came from (for navigation)
    fromListId: location.state?.initialList || null,
    // Track if initial data has been loaded
    initialDataLoaded: false,
    // Track the source of any mode changes (user action vs. initialization)
    isUserModeChange: false,
    // Track if we're currently fetching list data to prevent duplicate requests
    isFetchingListData: false
  });
  
  // Handle back button navigation
  const handleBackNavigation = () => {
    // If we came from list details, go back to that list
    if (initialStateRef.current.isFromListDetails && initialStateRef.current.fromListId) {
      navigate(`/lists/${initialStateRef.current.fromListId}`);
    } else {
      // Otherwise go to the hub
      navigate('/hub');
    }
  };
  
  // Reset to page 1 when filters or rating mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, selectedList, ratingMode, activeTab]);

  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedMedia]);

  useEffect(() => {
    const fetchData = async () => {
      // Skip if we're already fetching list data or a user-initiated change is happening
      if (initialStateRef.current.isFetchingListData || initialStateRef.current.isUserModeChange) {
        return;
      }
      
      try {
        // Skip fetching completely if we have preloaded data from ListDetails
        if (initialStateRef.current.hasPreloadedData) {
          // Just fetch the lists without triggering loading states
          const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
          const token = localStorage.getItem('token');
          
          // Only navigate away if no token
          if (!token) {
            navigate('/login');
            return;
          }
          
          // Silently fetch lists in the background without affecting the UI
          const listsResponse = await fetch(`${apiUrl}/api/lists`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (listsResponse.ok) {
            const listsData = await listsResponse.json();
            const userLists = Array.isArray(listsData) ? listsData : listsData.lists;
            setLists(userLists);
          }
          
          // No need to set loading to false, it's already false
          return;
        }
        
        // Normal fetch flow when no preloaded data
        setLoading(true);
        initialStateRef.current.isFetchingListData = true;
        
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        // Run these fetches in parallel for better performance
        const [userMediaResponse, listsResponse] = await Promise.all([
          // Fetch user's media for personal ratings
          fetch(`${apiUrl}/api/user/media`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }),
          
          // Fetch lists for average ratings section
          fetch(`${apiUrl}/api/lists`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          })
        ]);

        if (!userMediaResponse.ok) {
          throw new Error('Failed to fetch user media');
        }
        
        if (!listsResponse.ok) {
          throw new Error('Failed to fetch lists');
        }

        // Process user media data
        const userMediaData = await userMediaResponse.json();
        let allMedia = userMediaData.media_items || [];

        // Filter only rated media for personal ratings and create a unique set by TMDB ID
        const uniqueMediaMap = new Map();
        allMedia.forEach(item => {
          if (item.rating !== null && item.rating !== undefined) {
            if (uniqueMediaMap.has(item.tmdb_id)) {
              const existing = uniqueMediaMap.get(item.tmdb_id);
              if (item.rating > existing.rating) {
                uniqueMediaMap.set(item.tmdb_id, item);
              }
            } else {
              uniqueMediaMap.set(item.tmdb_id, item);
            }
          }
        });
        const uniqueRatedMedia = Array.from(uniqueMediaMap.values());
        
        // Process lists data
        const listsData = await listsResponse.json();
        const userLists = Array.isArray(listsData) ? listsData : listsData.lists;
        setLists(userLists);
        
        // Set media items based on the current mode
        if (ratingMode === 'personal') {
          setMediaItems(uniqueRatedMedia);
          setLoading(false);
        } else if (ratingMode === 'list_average' && selectedList !== 'all') {
          // Only fetch list averages if not done by the useEffect for selectedList
          try {
            const avgRatingsResponse = await fetch(`${apiUrl}/api/lists/${selectedList}/average_ratings`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });
            
            if (avgRatingsResponse.ok) {
              const avgRatingsData = await avgRatingsResponse.json();
              if (avgRatingsData.average_ratings && avgRatingsData.average_ratings.length > 0) {
                // Update the list information in each media item
                const selectedListInfo = userLists.find(list => list.id === parseInt(selectedList));
                const listNameValue = selectedListInfo ? selectedListInfo.name : listName || 'Unknown List';
                
                const processedRatings = avgRatingsData.average_ratings.map(item => ({
                  ...item,
                  list_id: parseInt(selectedList),
                  list_name: listNameValue
                }));
                
                setMediaItems(processedRatings);
              } else {
                setMediaItems([]);
              }
            }
          } catch (error) {
            console.error("Error fetching list averages:", error);
          }
          
          // Now set loading to false
          setLoading(false);
        } else {
          // List averages mode but no list selected
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
        setLoading(false);
      } finally {
        // Reset the fetching flag after a short delay
        setTimeout(() => {
          initialStateRef.current.isFetchingListData = false;
        }, 200);
      }
    };

    fetchData();
  }, [navigate, ratingMode, selectedList, listName]);

  // Update useEffect for list selection change
  useEffect(() => {
    const fetchListData = async () => {
      // Skip fetching if this is a user-initiated change (handled directly in handlers)
      if (initialStateRef.current.isUserModeChange || initialStateRef.current.isFetchingListData) {
        return;
      }
      
      // Only fetch list data if we're in list_average mode and a list is selected
      // Skip if we're still handling the initial navigation with preloaded data
      if (ratingMode === 'list_average' && selectedList !== 'all' && !initialStateRef.current.hasPreloadedData) {
        initialStateRef.current.isFetchingListData = true;
        setLoading(true);
        // Clear media items to prevent showing stale data
        setMediaItems([]);
        
        try {
          const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
          const token = localStorage.getItem('token');
          
          const avgRatingsResponse = await fetch(`${apiUrl}/api/lists/${selectedList}/average_ratings`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!avgRatingsResponse.ok) {
            throw new Error(`Failed to fetch average ratings for list ${selectedList}`);
          }
          
          const avgRatingsData = await avgRatingsResponse.json();
          if (avgRatingsData.average_ratings && avgRatingsData.average_ratings.length > 0) {
            // Update the list information in each media item
            const selectedListInfo = lists.find(list => list.id === parseInt(selectedList));
            const listNameValue = selectedListInfo ? selectedListInfo.name : 'Unknown List';
            
            const processedRatings = avgRatingsData.average_ratings.map(item => ({
              ...item,
              list_id: parseInt(selectedList),
              list_name: listNameValue
            }));
            
            setMediaItems(processedRatings);
          } else {
            setMediaItems([]);
          }
        } catch (err) {
          console.error(`Error fetching list averages:`, err);
          setError(err.message);
        } finally {
          setLoading(false);
          setTimeout(() => {
            initialStateRef.current.isFetchingListData = false;
          }, 200);
        }
      }
    };
    
    fetchListData();
  }, [selectedList, ratingMode, lists]);

  // Handle list selection change
  const handleListChange = (listId) => {
    // If we're already fetching data for this list or it's the same list, don't fetch again
    if (initialStateRef.current.isFetchingListData || selectedList === listId) {
      return;
    }
    
    // Find the selected list name
    const selectedListInfo = lists.find(list => list.id === parseInt(listId));
    const newListName = selectedListInfo ? selectedListInfo.name : '';
    
    // Set loading to provide feedback
    setLoading(true);
    
    // Set both flags to prevent duplicate fetches
    initialStateRef.current.isUserModeChange = true;
    initialStateRef.current.isFetchingListData = true;
    
    // Direct data fetching approach instead of relying on the useEffect chain
    const fetchSelectedListData = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        
        const avgRatingsResponse = await fetch(`${apiUrl}/api/lists/${listId}/average_ratings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!avgRatingsResponse.ok) {
          throw new Error(`Failed to fetch average ratings for list ${listId}`);
        }
        
        const avgRatingsData = await avgRatingsResponse.json();
        if (avgRatingsData.average_ratings && avgRatingsData.average_ratings.length > 0) {
          const processedRatings = avgRatingsData.average_ratings.map(item => ({
            ...item,
            list_id: parseInt(listId),
            list_name: newListName
          }));
          
          // Batch state updates after fetch completes to reduce renders
          setMediaItems(processedRatings);
          setListName(newListName);
          setSelectedList(listId);
        } else {
          // Batch state updates
          setMediaItems([]);
          setListName(newListName);
          setSelectedList(listId);
        }
      } catch (err) {
        console.error(`Error fetching list averages:`, err);
        setError(err.message);
        // Still update these states even on error
        setListName(newListName);
        setSelectedList(listId);
      } finally {
        setLoading(false);
        // Reset the flags after a short delay to prevent race conditions
        setTimeout(() => {
          initialStateRef.current.isUserModeChange = false;
          initialStateRef.current.isFetchingListData = false;
        }, 200);
      }
    };
    
    fetchSelectedListData();
  };

  // Handle rating mode change
  const handleRatingModeChange = async (mode) => {
    initialStateRef.current.isUserModeChange = true;
    
    // Set loading first for both modes
    setLoading(true);
    
    // When switching to list_average, clear media items immediately to prevent flickering
    if (mode === 'list_average') {
      // Clear the media items first to prevent showing stale content
      setMediaItems([]);
      setRatingMode(mode);
      setSelectedList('all');
      
      // Keep the loading state active while lists are shown
      setTimeout(() => {
        setLoading(false);
        // Reset the user mode change flag after a short delay
        setTimeout(() => {
          initialStateRef.current.isUserModeChange = false;
        }, 100);
      }, 100);
    } else if (mode === 'personal') {
      // For personal mode, keep current flow but ensure loading is set first
      setRatingMode(mode);
      setSelectedList('all'); // Reset list selection
      
      // Directly fetch data when changing to personal mode instead of relying on the useEffect
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          return;
        }
        
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
        let allMedia = userMediaData.media_items || [];
        
        // Filter only rated media and create a unique set by TMDB ID
        const uniqueMediaMap = new Map();
        allMedia.forEach(item => {
          if (item.rating !== null && item.rating !== undefined) {
            if (uniqueMediaMap.has(item.tmdb_id)) {
              const existing = uniqueMediaMap.get(item.tmdb_id);
              if (item.rating > existing.rating) {
                uniqueMediaMap.set(item.tmdb_id, item);
              }
            } else {
              uniqueMediaMap.set(item.tmdb_id, item);
            }
          }
        });
        
        setMediaItems(Array.from(uniqueMediaMap.values()));
      } catch (err) {
        console.error('Error fetching personal ratings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
        // Reset the preloaded data flag since we're explicitly loading new data
        initialStateRef.current.hasPreloadedData = false;
        // Reset the user mode change flag after a short delay
        setTimeout(() => {
          initialStateRef.current.isUserModeChange = false;
        }, 100);
      }
    }
  };

  const getFilteredAndSortedMedia = () => {
    return mediaItems
      .filter(media => {
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        return matchesMediaType;
      })
      .sort((a, b) => {
        // For personal ratings
        if (ratingMode === 'personal') {
          return activeTab === 'highest' ? b.rating - a.rating : a.rating - b.rating;
        } 
        // For list average ratings - handle undefined values safely
        else {
          // Ensure we have valid values for comparison
          const aRating = a.average_rating || 0;
          const bRating = b.average_rating || 0;
          return activeTab === 'highest' ? bRating - aRating : aRating - bRating;
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
      
      // Updated API endpoint pattern matching ListDetails.js and Hub.js
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update media');

      // Refetch data to ensure we have the latest
      const userMediaResponse = await fetch(`${apiUrl}/api/user/media`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (userMediaResponse.ok) {
        const userMediaData = await userMediaResponse.json();
        let allMedia = userMediaData.media_items || [];
        
        // Filter rated media and deduplicate
        const uniqueMediaMap = new Map();
        allMedia.forEach(item => {
          if (item.rating !== null && item.rating !== undefined) {
            if (uniqueMediaMap.has(item.tmdb_id)) {
              const existing = uniqueMediaMap.get(item.tmdb_id);
              if (item.rating > existing.rating) {
                uniqueMediaMap.set(item.tmdb_id, item);
              }
            } else {
              uniqueMediaMap.set(item.tmdb_id, item);
            }
          }
        });
        
        setMediaItems(Array.from(uniqueMediaMap.values()));
      }

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
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedMedia.list_id}/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete media');

      // Remove the item from state
      setMediaItems(prevItems => prevItems.filter(item => item.id !== mediaId));
      setSelectedMedia(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  const handleMediaClick = (media) => {
    if (ratingMode === 'list_average') {
      // If clicking a list average item, try to find personal copy first
      const personalCopy = mediaItems.find(item => item.tmdb_id === media.tmdb_id);
      setSelectedMedia(personalCopy || media);
      
      // If in list average mode, fetch individual user ratings
      if (selectedList !== 'all' && media.id) {
        fetchMediaRatings(media.id);
      } else if (selectedList !== 'all') {
        // Find the media item in the list
        fetchMediaByTmdbId(media.tmdb_id, selectedList);
      }
    } else {
      setSelectedMedia(media);
    }
  };
  
  // Function to fetch individual user ratings for a media item
  const fetchMediaRatings = async (mediaId) => {
    try {
      setLoadingRatings(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/lists/${selectedList}/media/${mediaId}/ratings`, {
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
  
  // Function to fetch media by TMDB ID when we don't have the media ID yet
  const fetchMediaByTmdbId = async (tmdbId, listId) => {
    try {
      setLoadingRatings(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // First query the optimized endpoint to get the media ID from TMDB ID
      const mediaLookupResponse = await fetch(`${apiUrl}/api/lists/${listId}/media?tmdb_id=${tmdbId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!mediaLookupResponse.ok) {
        throw new Error('Failed to find media in list');
      }
      
      const mediaData = await mediaLookupResponse.json();
      
      if (!mediaData.media_item || !mediaData.media_item.id) {
        throw new Error('Media not found in list');
      }
      
      // Now that we have the media ID, fetch the ratings
      const ratingsResponse = await fetch(`${apiUrl}/api/lists/${listId}/media/${mediaData.media_item.id}/ratings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!ratingsResponse.ok) {
        throw new Error('Failed to fetch media ratings');
      }
      
      const ratingsData = await ratingsResponse.json();
      setMediaRatings(ratingsData);
    } catch (err) {
      console.error('Error fetching media ratings by TMDB ID:', err);
      setLoadingRatings(false);
    } finally {
      setLoadingRatings(false);
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
              onClick={handleBackNavigation}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold">
              {ratingMode === 'list_average' && selectedList !== 'all' && listName 
                ? `${listName} Rankings` 
                : 'Media Rankings'}
            </h1>
          </div>
        </motion.div>

        {/* Rating Mode Toggle (Personal vs List Average) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-1 flex">
            <button
              onClick={() => handleRatingModeChange('personal')}
              className={`flex-1 py-2 rounded-md transition-colors duration-200 ${
                ratingMode === 'personal' 
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              My Ratings
            </button>
            <button
              onClick={() => handleRatingModeChange('list_average')}
              className={`flex-1 py-2 rounded-md transition-colors duration-200 ${
                ratingMode === 'list_average'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              List Averages
            </button>
          </div>
        </motion.div>

        {/* List selection for Average Ratings mode only */}
        {ratingMode === 'list_average' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
              <label className="block text-sm text-gray-400 mb-2">Select a List</label>
              <select
                value={selectedList}
                onChange={(e) => handleListChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all" disabled>Select a list</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              {lists.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  You don't have any lists yet. Create a list to see average ratings.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Filtration Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ mediaType: 'all' })}
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

        {/* Show empty state if no rated media */}
        {((ratingMode === 'personal' && mediaItems.length === 0) || 
         (ratingMode === 'list_average' && (selectedList === 'all' || mediaItems.length === 0))) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <div className="text-gray-400">
                <span className="text-yellow-500 text-5xl block mx-auto mb-4 opacity-50">⭐</span>
                <h3 className="text-xl font-semibold mb-2">No Rated Media</h3>
                <p className="text-gray-500 mb-4">
                  {ratingMode === 'personal' 
                    ? "Rate some movies or TV shows to see them here!" 
                    : selectedList === 'all'
                      ? "Please select a list to view average ratings"
                      : "No average ratings available for this list."}
                </p>
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
            {/* No Results Message */}
            {(mediaItems.length > 0 && getFilteredAndSortedMedia().length === 0) && (
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
                  key={`${media.tmdb_id}-${index}`}
                  onClick={() => handleMediaClick(media)}
                  className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors duration-200"
                >
                  <div className="text-gray-400 font-medium w-8">
                    #{indexOfFirstItem + index + 1}
                  </div>
                  <img
                    src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                    alt={media.title || media.name}
                    className="w-12 h-18 object-cover rounded"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/92x138?text=No+Image';
                    }}
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{media.title || media.name}</h3>
                    <div className="flex items-center text-sm text-gray-400 gap-2">
                      {/* Show year if available */}
                      {(media.release_date || media.first_air_date) && (
                        <span>{(media.release_date || media.first_air_date).split('-')[0]}</span>
                      )}
                      {/* Show TMDB rating if available */}
                      {media.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 01-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 01-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 01.951-.69l1.07-3.292z"></path>
                          </svg>
                          {media.vote_average.toFixed(1)} (TMDB)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded ${
                    activeTab === 'highest' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    <span className="text-yellow-500">⭐</span>
                    <span className={`font-medium ${
                      activeTab === 'highest' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ratingMode === 'personal' 
                        ? media.rating 
                        : media.average_rating ? media.average_rating.toFixed(1) : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {/* Page indicator - Mobile */}
                <div className="md:hidden flex items-center gap-1">
                  <span className="text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 01.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 01-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 01-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 01.951-.69l1.07-3.292z"></path>
                          </svg>
                          <span className="font-medium">{selectedMedia.vote_average?.toFixed(1)}</span> (TMDB)
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

                    {/* Show average rating if in list average mode */}
                    {ratingMode === 'list_average' && selectedMedia.average_rating && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">List Average Rating</h4>
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 01-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 01-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 01.951-.69l1.07-3.292z"></path>
                          </svg>
                          <span className="text-xl font-medium text-white">{selectedMedia.average_rating.toFixed(1)}</span>
                          <span className="text-sm text-gray-400">from {selectedMedia.rating_count || 0} ratings</span>
                        </div>
                      </div>
                    )}
                    
                    {/* User Ratings (for list averages) */}
                    {ratingMode === 'list_average' && selectedList !== 'all' && (
                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">User Ratings</h4>
                        {loadingRatings ? (
                          <div className="flex justify-center p-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        ) : mediaRatings && mediaRatings.ratings && mediaRatings.ratings.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2">
                            {mediaRatings.ratings
                              .sort((a, b) => {
                                // First sort by rating (highest first)
                                if (a.rating && b.rating) {
                                  return b.rating - a.rating;
                                }
                                // If one has rating and other doesn't, rated items first
                                if (a.rating && !b.rating) return -1;
                                if (!a.rating && b.rating) return 1;
                                
                                // If neither has rating, sort by watch status priority
                                const statusPriority = {
                                  'completed': 0,
                                  'in_progress': 1,
                                  'not_watched': 2
                                };
                                
                                return statusPriority[a.watch_status] - statusPriority[b.watch_status];
                              })
                              .map((rating, index) => (
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
                                      <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 01-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 01-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 01.951-.69l1.07-3.292z"></path>
                                      </svg>
                                      <span className="font-medium">{rating.rating}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 p-3 bg-slate-700/20 rounded-lg">No ratings from list members yet.</p>
                        )}
                      </div>
                    )}

                    {/* Only show status and rating controls for personal media items */}
                    {selectedMedia.watch_status && (
                      <>
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
                      </>
                    )}

                    {/* List Information - only show for list average mode */}
                    {selectedMedia.list_name && ratingMode === 'list_average' && (
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
                    )}

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

                    {/* Remove from List Button - only show for list average mode */}
                    {selectedMedia.id && ratingMode === 'list_average' && !showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full bg-red-500/20 text-red-500 hover:bg-red-500/30 px-4 py-2 rounded-lg mt-4 transition-colors duration-200"
                      >
                        Remove from List
                      </button>
                    ) : selectedMedia.id && ratingMode === 'list_average' && showDeleteConfirm ? (
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
                    ) : null}
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

export default Rankings;