import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Utility component that scrolls to top when navigating between routes
export const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
};

export const scrollToFAQ = () => {
  const currentPath = window.location.pathname;
  
  if (currentPath !== '/') {
    window.location.href = '/#faq-section';
    setTimeout(() => {
      const faqSection = document.getElementById('faq-section');
      if (faqSection) {
        const headerOffset = 80;
        const elementPosition = faqSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  } else {
    const faqSection = document.getElementById('faq-section');
    if (faqSection) {
      const headerOffset = 80;
      const elementPosition = faqSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }
};