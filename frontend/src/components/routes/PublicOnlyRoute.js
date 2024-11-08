import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900/95">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to home/hub if user is already authenticated
  if (isAuthenticated) {
    // Redirect to the page they came from, or hub if none specified
    return <Navigate to={location.state?.from?.pathname || '/hub'} replace />;
  }

  return children;
};

export default PublicOnlyRoute;
