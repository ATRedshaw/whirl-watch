import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path) => {
    if (path === 'back') {
      // Check if there's history to go back to
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full text-center"
      >
        <motion.h1
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-8xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-500 to-purple-600"
        >
          404
        </motion.h1>
        
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        
        <p className="text-gray-400 mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
          <br />
          <span className="text-sm">
            Path: <code className="text-sky-400">{location.pathname}</code>
          </span>
        </p>

        <div className="space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavigate('back')}
            className="px-6 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
          >
            Go Back
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavigate('/')}
            className="px-6 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
          >
            Home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
