import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, isAuthenticated } = useAuth();
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navItems = isAuthenticated
    ? [
        { name: 'Hub', path: '/hub' },
        { name: 'My Lists', path: '/lists' },
      ]
    : [
        { name: 'Login', path: '/login' },
        { name: 'Create Account', path: '/register' },
      ];

  return (
    <nav className="bg-slate-900/95 backdrop-blur-sm fixed w-full z-50 top-0 left-0 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <motion.h1 
              whileHover={{ scale: 1.05 }}
              className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-500 to-purple-600"
            >
              Whirl Watch
            </motion.h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="relative group"
                >
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-block transition-colors duration-200"
                  >
                    {item.name}
                  </motion.span>
                  <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-gradient-to-r from-sky-400 to-blue-500 transform scale-x-0 transition-transform group-hover:scale-x-100" />
                </Link>
              ))}
              {isAuthenticated && (
                <>
                  <Link
                    to="/profile"
                    className="relative group"
                  >
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium inline-block transition-colors duration-200"
                    >
                      Account Management
                    </motion.span>
                    <span className="absolute bottom-1 left-3 right-3 h-0.5 bg-gradient-to-r from-sky-400 to-blue-500 transform scale-x-0 transition-transform group-hover:scale-x-100" />
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={logout}
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/30"
                  >
                    Logout
                  </motion.button>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className={`${isOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                className={`${isOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-800"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 bg-slate-900/95 backdrop-blur-sm">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="block relative group"
                >
                  <motion.span
                    whileHover={{ x: 10 }}
                    className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 bg-gradient-to-r from-transparent to-transparent hover:from-slate-800/50 hover:to-transparent"
                  >
                    {item.name}
                  </motion.span>
                </Link>
              ))}
              {isAuthenticated && (
                <>
                  <Link
                    to="/profile"
                    className="block relative group"
                  >
                    <motion.span
                      whileHover={{ x: 10 }}
                      className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 bg-gradient-to-r from-transparent to-transparent hover:from-slate-800/50 hover:to-transparent"
                    >
                      Account Management
                    </motion.span>
                  </Link>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={logout}
                    className="text-gray-300 hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/30"
                  >
                    Logout
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
