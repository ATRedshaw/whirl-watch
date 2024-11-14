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