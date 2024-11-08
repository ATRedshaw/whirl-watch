import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="container mx-auto px-4 py-16 md:py-24">
        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={fadeIn}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-500 to-purple-600 drop-shadow-lg tracking-tight">
            WhirlWatch
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Track, Share, and Discover Movies Together
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(isAuthenticated ? '/hub' : '/register')}
            className="bg-gradient-to-r from-sky-600 to-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
          >
            {isAuthenticated ? 'Go to Hub' : 'Create Account'}
          </motion.button>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial="hidden"
              animate={isVisible ? "visible" : "hidden"}
              variants={fadeIn}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="bg-slate-800 rounded-xl p-6 hover:bg-slate-700 transition-colors duration-300"
            >
              <div className="text-sky-400 text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const features = [
  {
    icon: "📝",
    title: "Create Watchlists",
    description: "Organize your movies into custom lists and track what you want to watch."
  },
  {
    icon: "🤝",
    title: "Share with Friends", 
    description: "Generate unique codes to share your movie lists with friends and family."
  },
  {
    icon: "🔍",
    title: "Discover Movies",
    description: "Search through thousands of movies and get detailed information about each one."
  }
];

export default HomePage;