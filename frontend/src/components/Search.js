import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import { useNavigate } from 'react-router-dom';

const Search = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('movie'); // 'movie' or 'tv'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [addToListError, setAddToListError] = useState(null);
  const [processingLists, setProcessingLists] = useState(new Set());
  const navigate = useNavigate();

  // Fetch user's lists on component mount
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/lists`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLists(data.lists);
      } catch (err) {
        setError('Failed to fetch lists');
        console.error(err);
      }
    };

    fetchLists();
  }, []);

  // Debounced search function
  const debouncedSearch = debounce(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${apiUrl}/api/search?query=${encodeURIComponent(searchQuery)}&type=${activeTab}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data.results);
    } catch (err) {
      setError(`Failed to search ${activeTab === 'movie' ? 'movies' : 'TV shows'}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, 500);

  const handleSearch = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setResults([]);
    
    if (query.trim()) {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      fetch(
        `${apiUrl}/api/search?query=${encodeURIComponent(query)}&type=${tab}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
        .then(response => response.json())
        .then(data => {
          if (!data.error) {
            setResults(data.results);
          } else {
            throw new Error(data.error);
          }
        })
        .catch(err => {
          setError(`Failed to search ${tab === 'movie' ? 'movies' : 'TV shows'}`);
          console.error(err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleListToggle = async (listId) => {
    if (!selectedMedia) return;
    
    setProcessingLists(prev => new Set([...prev, listId]));
    setAddToListError(null);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const isRemoving = selectedMedia.addedToLists?.includes(listId);
      
      const url = isRemoving 
        ? `${apiUrl}/api/lists/${listId}/media/tmdb/${selectedMedia.id}`
        : `${apiUrl}/api/lists/${listId}/media`;
      
      const response = await fetch(url, {
        method: isRemoving ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        ...(isRemoving ? {} : {
          body: JSON.stringify({
            tmdb_id: selectedMedia.id,
            media_type: activeTab,
            watch_status: 'not_watched'
          })
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update list');
      }

      const updatedLists = isRemoving 
        ? (selectedMedia.addedToLists || []).filter(id => id !== listId)
        : [...(selectedMedia.addedToLists || []), listId];

      setSelectedMedia(prev => ({
        ...prev,
        addedToLists: updatedLists
      }));

      setResults(prevResults => 
        prevResults.map(result => 
          result.id === selectedMedia.id
            ? {
                ...result,
                addedToLists: updatedLists
              }
            : result
        )
      );

    } catch (err) {
      console.error('Error in handleListToggle:', err);
      setAddToListError(err.message);
    } finally {
      setProcessingLists(prev => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }
  };

  const handleCardClick = (media) => {
    setSelectedDetails(media);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      {/* Search Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Search {activeTab === 'movie' ? 'Movies' : 'TV Shows'}
        </h1>
        <p className="text-gray-400 mb-4">
          Hey {user.username}, find {activeTab === 'movie' ? 'movies' : 'TV shows'} to add to your lists
        </p>

        {/* Tabs */}
        <div className="flex justify-center space-x-4 mb-4">
          <button
            onClick={() => handleTabChange('movie')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              activeTab === 'movie'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => handleTabChange('tv')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              activeTab === 'tv'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
            }`}
          >
            TV Shows
          </button>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder={`Search for ${activeTab === 'movie' ? 'movies' : 'TV shows'}...`}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {loading && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-4xl mx-auto mb-8 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg p-4"
        >
          {error}
        </motion.div>
      )}

      {/* Results Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map(media => (
            <motion.div
              key={media.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden cursor-pointer group"
              onClick={() => handleCardClick(media)}
            >
              {/* Mobile Layout (Horizontal Card) */}
              <div className="flex sm:hidden">
                {/* Poster */}
                <div className="relative w-24 h-36 shrink-0">
                  {media.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                      alt={media.title || media.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No poster</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-3 min-w-0 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-base font-semibold line-clamp-1 group-hover:text-blue-400 transition-colors duration-200 mr-2">
                      {media.title || media.name}
                    </h3>
                    {media.addedToLists?.length > 0 && (
                      <div className="inline-flex bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-sm font-medium whitespace-nowrap">
                        ✓ In Lists
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <span>{(media.release_date || media.first_air_date)?.split('-')[0]}</span>
                    {media.vote_average && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {media.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Fixed description truncation */}
                  <div className="mb-2 h-[2.5rem] overflow-hidden relative">
                    <p className="text-gray-300 text-xs line-clamp-2">
                      {media.overview}
                    </p>
                  </div>

                  {/* Add to List Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedia(media);
                    }}
                    className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors duration-200 mt-auto"
                  >
                    Add to List
                  </button>
                </div>
              </div>

              {/* Desktop Layout (Original Vertical Card) */}
              <div className="hidden sm:flex sm:flex-col">
                {/* Media Poster */}
                <div className="relative w-full aspect-[2/3] group-hover:opacity-80 transition-opacity duration-200">
                  {media.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${media.poster_path}`}
                      alt={media.title || media.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No poster</span>
                    </div>
                  )}
                  
                  {/* "In Lists" badge for desktop */}
                  {media.addedToLists?.length > 0 && (
                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-md font-medium shadow-md">
                      In Your Lists
                    </div>
                  )}
                </div>

                {/* Media Info */}
                <div className="p-3 flex flex-col flex-grow">
                  <h3 className="text-lg font-semibold mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors duration-200">
                    {media.title || media.name}
                  </h3>
                  <p className="text-gray-400 text-xs mb-2">
                    {(media.release_date || media.first_air_date)?.split('-')[0]}
                  </p>
                  <p className="text-gray-300 text-xs mb-3 line-clamp-2 flex-grow">
                    {media.overview}
                  </p>

                  {/* Add to List Button - Stop propagation to prevent modal from opening */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedia(media);
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                  >
                    Add to List
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setSelectedDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-lg overflow-hidden max-w-2xl w-full my-auto relative flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button (X) for all screen sizes */}
              <button 
                onClick={() => setSelectedDetails(null)}
                className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
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
                    {selectedDetails.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${selectedDetails.poster_path}`}
                        alt={selectedDetails.title || selectedDetails.name}
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
                      {selectedDetails.title || selectedDetails.name}
                    </h2>

                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                      <span>{(selectedDetails.release_date || selectedDetails.first_air_date)?.split('-')[0]}</span>
                      {selectedDetails.vote_average && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {selectedDetails.vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-300 mb-6 leading-relaxed">
                      {selectedDetails.overview}
                    </p>

                    {/* Additional details for TV shows */}
                    {activeTab === 'tv' && selectedDetails.number_of_seasons && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-2">Show Info</h3>
                        <div className="space-y-2 text-sm text-gray-300">
                          <p>Seasons: {selectedDetails.number_of_seasons}</p>
                          <p>Episodes: {selectedDetails.number_of_episodes}</p>
                          <p>Status: {selectedDetails.status}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Button Section */}
              <div className="sticky bottom-0 p-4 bg-slate-800 border-t border-slate-700">
                <button
                  onClick={() => {
                    setSelectedMedia(selectedDetails);
                    setSelectedDetails(null);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                >
                  Add to List
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to List Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedMedia(null);
              setAddToListError(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button (X) for all screen sizes */}
              <button 
                onClick={() => {
                  setSelectedMedia(null);
                  setAddToListError(null);
                }}
                className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <h3 className="text-xl font-semibold mb-4">
                Add "{selectedMedia.title || selectedMedia.name}" to List
              </h3>

              {/* Error Message */}
              {addToListError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg"
                >
                  {addToListError}
                </motion.div>
              )}

              {lists.length > 0 ? (
                <div className="space-y-2">
                  {lists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => handleListToggle(list.id)}
                      disabled={processingLists.has(list.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors duration-200 relative ${
                        selectedMedia.addedToLists?.includes(list.id)
                          ? 'bg-green-500/20 hover:bg-green-500/30'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{list.name}</span>
                        {processingLists.has(list.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                        ) : (
                          selectedMedia.addedToLists?.includes(list.id) && (
                            <svg 
                              className="w-5 h-5 text-green-500" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                          )
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mb-4 text-gray-400">
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
                        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <p className="text-lg font-semibold mb-2">No Lists Found</p>
                    <p className="text-sm">Create a list to start tracking your movies and shows!</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMedia(null);
                      navigate('/lists/create');
                    }}
                    className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                  >
                    Create a List
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Search;