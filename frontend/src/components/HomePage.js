import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
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
            Track, Share, and Discover Movies & TV Shows Together
          </p>
          {isAuthenticated ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/hub')}
              className="bg-gradient-to-r from-sky-600 to-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
            >
              Go to Hub
            </motion.button>
          ) : (
            <div className="flex justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-sky-600 to-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
              >
                Login
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-sky-600 to-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
              >
                Create Account
              </motion.button>
            </div>
          )}
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

        {/* FAQ Section */}
        <motion.div
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={fadeIn}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="space-y-6"
        >
          <h2 className="text-3xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                className="bg-slate-800/50 rounded-xl overflow-hidden"
                initial={false}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/70 transition-colors duration-300"
                >
                  <h3 className="text-xl font-semibold text-sky-400">{faq.question}</h3>
                  <span className={`transform transition-transform duration-300 ${expandedFaq === index ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: expandedFaq === index ? 'auto' : 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 text-gray-300">
                    {faq.answer}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const features = [
  {
    icon: "🔍", 
    title: "Discover Content",
    description: "Search through thousands of films and TV shows and get detailed information about each one."
  },
  {
    icon: "📝",
    title: "Create & Share Watchlists",
    description: "Organise your films and TV shows into custom lists, then share them with friends using unique codes."
  },
  {
    icon: "🎲",
    title: "Can't Decide? Spin the Wheel",
    description: "Let the roulette wheel randomly pick your next watch from your lists when you're feeling indecisive."
  }
];

const faqs = [
  {
    question: "What is WhirlWatch?",
    answer: "WhirlWatch is a free platform that helps you track, organise, and discover films and TV shows. You can create watchlists, share them with friends, and keep track of what you're watching."
  },
  {
    question: "How do lists work?",
    answer: "You can create up to 10 custom lists to organise your films and TV shows. Each list can be shared with up to 8 other users using a unique sharing code. Lists can include both films and TV shows."
  },
  {
    question: "How does the rating system work?",
    answer: "After completing a film or TV show, you can rate it on a scale. Your ratings are tracked and you can view your highest and lowest rated content, helping you and your friends discover what's worth watching."
  },
  {
    question: "What is the Watch Status feature?",
    answer: "Each item in your lists can be marked as 'Not Started', 'In Progress', or 'Completed'. This helps you keep track of what you're currently watching and what you plan to watch next."
  },
  {
    question: "How does Roulette Wheel work?",
    answer: "When you can't decide what to watch, the Roulette Wheel feature randomly selects something from your watchlist. You can apply filters before randomisation for further refinement and spin it multiple times until you find something that interests you."
  },
  {
    question: "Is my account secure?",
    answer: (
      <div className="text-gray-300">
        The platform implements comprehensive security measures:
        <ul className="list-disc list-inside">
          <li className="ml-4">Mandatory email verification for all new accounts</li>
          <li className="ml-4">Secure password reset system with email verification</li>
          <li className="ml-4">JWT authentication protecting all user data and watchlists</li>
          <li className="ml-4">Rate-limiting on sensitive actions to prevent unauthorised access</li>
          <li className="ml-4">Industry-standard hashing algorithms securing all sensitive data</li>
        </ul>
      </div>
    )
  },
  {
    question: "How often is the content database updated?",
    answer: "The film and TV show database is updated regularly through TMDB (The Movie Database) to ensure you have access to the latest releases and information."
  },
  {
    question: "Can I use WhirlWatch on my mobile device?",
    answer: "Yes! WhirlWatch is fully responsive and works brilliantly on mobile devices, tablets, and desktop computers, allowing you to manage your watchlists from anywhere."
  }
];

export default HomePage;