import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';

const Search = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [addingToList, setAddingToList] = useState(false);

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
      setMovies([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${apiUrl}/api/movies/search?query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMovies(data.results);
    } catch (err) {
      setError('Failed to search movies');
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

  const handleAddToList = async (listId) => {
    if (!selectedMovie) return;

    setAddingToList(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${listId}/movies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tmdb_id: selectedMovie.id,
          watch_status: 'not_watched'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Show success message
      setSelectedMovie(prev => ({
        ...prev,
        addedToLists: [...(prev.addedToLists || []), listId]
      }));
    } catch (err) {
      setError('Failed to add movie to list');
      console.error(err);
    } finally {
      setAddingToList(false);
    }
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
          Search Movies
        </h1>
        <p className="text-gray-400 mb-4">
          Hey {user.username}, find movies to add to your lists
        </p>
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Search for movies..."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {movies.map(movie => (
            <motion.div
              key={movie.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
            >
              {/* Movie Poster */}
              <div className="relative aspect-[2/3]">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <span className="text-gray-400">No poster available</span>
                  </div>
                )}
              </div>

              {/* Movie Info */}
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-2">{movie.title}</h3>
                <p className="text-gray-400 text-sm mb-4">
                  {movie.release_date?.split('-')[0]}
                </p>
                <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                  {movie.overview}
                </p>

                {/* Add to List Button */}
                <button
                  onClick={() => setSelectedMovie(movie)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                >
                  Add to List
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Add to List Modal */}
      <AnimatePresence>
        {selectedMovie && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedMovie(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold mb-4">
                Add "{selectedMovie.title}" to List
              </h3>
              
              <div className="space-y-2">
                {lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => handleAddToList(list.id)}
                    disabled={addingToList || selectedMovie.addedToLists?.includes(list.id)}
                    className={`w-full p-3 rounded-lg text-left transition-colors duration-200 ${
                      selectedMovie.addedToLists?.includes(list.id)
                        ? 'bg-green-500/20 text-green-500 cursor-default'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{list.name}</span>
                      {selectedMovie.addedToLists?.includes(list.id) && (
                        <span>✓ Added</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedMovie(null)}
                className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Search;
