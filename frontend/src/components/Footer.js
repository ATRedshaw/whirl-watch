import React from 'react';
import { scrollToFAQ } from '../utils/scrollUtils';

const Footer = () => {
  return (
    <footer className="mt-auto py-4 px-4 bg-slate-900/50 border-t border-slate-800">
      <div className="max-w-7xl mx-auto text-sm text-gray-400">
        <div className="flex flex-col items-center justify-center gap-y-2 md:flex-row md:gap-x-8">
          <div className="flex items-center w-full justify-center md:w-auto">
            <button
              onClick={scrollToFAQ}
              className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              FAQs
            </button>
          </div>
          <div className="flex items-center w-full justify-center md:w-auto">
            Developed by{' '}
            <a
              href="https://github.com/ATRedshaw"
              target="_blank"
              rel="noopener noreferrer" 
              className="ml-1 text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              Alex Redshaw
            </a>
          </div>
          <div className="flex items-center w-full justify-center md:w-auto">
            Media data powered by{' '}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              TMDB
            </a>
          </div>
          <div className="flex items-center w-full justify-center md:w-auto">
            Need help?{' '}
            <a
              href="mailto:whirlwatch@gmail.com"
              className="ml-1 text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              Email Whirlwatch
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;