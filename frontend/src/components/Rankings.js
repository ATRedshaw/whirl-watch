import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Ratings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'highest');
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedList, setSelectedList] = useState('all');
  const [lists, setLists] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    mediaType: 'all'
  });

  useEffect(() => {
    const fetchRatedMedia = async () => {
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

        for (const list of lists) {
          const listResponse = await fetch(`${apiUrl}/api/lists/${list.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const processedMedia = listData.media_items.map(item => ({
              ...item,
              listName: list.name,
              listId: list.id
            }));
            allMedia.push(...processedMedia);
          }
        }

        // Filter only rated media
        const ratedMedia = allMedia.filter(item => item.rating);
        setMediaItems(ratedMedia);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRatedMedia();
  }, [navigate]);

  const getFilteredAndSortedMedia = () => {
    return mediaItems
      .filter(media => {
        const matchesSearch = media.title?.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMediaType = filters.mediaType === 'all' || media.media_type === filters.mediaType;
        const matchesList = selectedList === 'all' || media.listId === parseInt(selectedList);
        
        return matchesSearch && matchesMediaType && matchesList;
      })
      .sort((a, b) => activeTab === 'highest' ? b.rating - a.rating : a.rating - b.rating);
  };

  // Get current items for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = getFilteredAndSortedMedia().slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(getFilteredAndSortedMedia().length / itemsPerPage);

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
        <h1 className="text-3xl font-bold mb-8">All-Time Ratings</h1>

        {/* Filtration Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* List Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">List</label>
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Lists</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ search: '', mediaType: 'all' });
                  setSelectedList('all');
                }}
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

        {/* No Results Message */}
        {mediaItems.length > 0 && getFilteredAndSortedMedia().length === 0 && (
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
              key={media.id}
              className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="text-gray-400 font-medium w-8">
                #{indexOfFirstItem + index + 1}
              </div>
              <img
                src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                alt={media.title}
                className="w-12 h-18 object-cover rounded"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/92x138?text=No+Image';
                }}
              />
              <div className="flex-1">
                <h3 className="font-medium">{media.title || media.name}</h3>
                <p className="text-sm text-gray-400">From: {media.listName}</p>
              </div>
              <div className={`flex items-center gap-1 px-3 py-1 rounded ${
                activeTab === 'highest' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                <span className="text-yellow-500">⭐</span>
                <span className={`font-medium ${
                  activeTab === 'highest' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {media.rating}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
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
        )}
      </motion.div>
    </div>
  );
};

export default Ratings;