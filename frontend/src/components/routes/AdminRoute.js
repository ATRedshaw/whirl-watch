import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotFound from '../NotFound';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show 404 page instead of redirecting for non-admin users
  if (!user.is_admin) {
    return <NotFound />;
  }

  return children;
};

export default AdminRoute;