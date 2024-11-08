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
  const [inProgressMovies, setInProgressMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalMovies: 0,
    watched: 0,
    inProgress: 0,
    notStarted: 0,
    averageRating: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');

        // Fetch lists
        const listsResponse = await fetch(`${apiUrl}/api/lists`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const listsData = await listsResponse.json();

        if (!listsResponse.ok) throw new Error(listsData.error);
        setLists(listsData.lists);

        // Calculate statistics from lists
        let totalMovies = 0;
        let watchedCount = 0;
        let inProgressCount = 0;
        let totalRating = 0;
        let ratedCount = 0;
        const inProgress = [];

        // Process movie data
        listsData.lists.forEach(list => {
          list.movies?.forEach(movie => {
            totalMovies++;
            if (movie.watch_status === 'watched') watchedCount++;
            if (movie.watch_status === 'in_progress') {
              inProgressCount++;
              inProgress.push({
                ...movie,
                listName: list.name
              });
            }
            if (movie.rating) {
              totalRating += movie.rating;
              ratedCount++;
            }
          });
        });

        setStats({
          totalMovies,
          watched: watchedCount,
          inProgress: inProgressCount,
          notStarted: totalMovies - watchedCount - inProgressCount,
          averageRating: ratedCount ? (totalRating / ratedCount).toFixed(1) : 0
        });

        setInProgressMovies(inProgress);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const chartData = {
    labels: ['Watched', 'In Progress', 'Not Started'],
    datasets: [{
      data: [stats.watched, stats.inProgress, stats.notStarted],
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

  const handleStatusUpdate = async (movieId, newStatus) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      
      // Find the movie and its list
      const movie = inProgressMovies.find(m => m.id === movieId);
      if (!movie) return;

      const response = await fetch(
        `${apiUrl}/api/lists/${movie.list_id}/movies/${movieId}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Update local state
      setInProgressMovies(prevMovies => 
        prevMovies.map(m => 
          m.id === movieId 
            ? { ...m, watch_status: newStatus }
            : m
        )
      );

      // Update stats
      setStats(prevStats => {
        const newStats = { ...prevStats };
        if (movie.watch_status === 'in_progress') newStats.inProgress--;
        if (newStatus === 'in_progress') newStats.inProgress++;
        if (movie.watch_status === 'watched') newStats.watched--;
        if (newStatus === 'watched') newStats.watched++;
        return newStats;
      });

    } catch (err) {
      console.error('Failed to update status:', err);
      // Optionally show error to user
      setError(err.message);
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
        <p className="text-gray-400">Your movie tracking dashboard</p>
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
          <h3 className="text-lg font-semibold mb-2">Find Movies</h3>
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
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Total Movies</h3>
          <p className="text-2xl font-bold">{stats.totalMovies}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h3 className="text-gray-400 text-sm mb-1">Watched</h3>
          <p className="text-2xl font-bold text-green-500">{stats.watched}</p>
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

      {/* In Progress Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-800/50 p-6 rounded-lg border border-slate-700"
      >
        <h3 className="text-xl font-semibold mb-4">Continue Watching</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inProgressMovies.map(movie => (
            <div
              key={movie.id}
              className="bg-slate-700/30 p-4 rounded-lg"
            >
              <div className="flex items-start gap-4">
                <img
                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                  alt={movie.title}
                  className="w-16 h-24 object-cover rounded"
                />
                <div>
                  <h4 className="font-semibold">{movie.title}</h4>
                  <p className="text-sm text-gray-400 mb-2">From: {movie.listName}</p>
                  <select
                    className="bg-slate-600 text-sm rounded px-2 py-1"
                    value={movie.watch_status}
                    onChange={(e) => handleStatusUpdate(movie.id, e.target.value)}
                  >
                    <option value="not_watched">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="watched">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Hub;