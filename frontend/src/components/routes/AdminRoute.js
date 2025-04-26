import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotFound from '../NotFound';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Show 404 page for both non-authenticated users and non-admin users
  if (!isAuthenticated || !user?.is_admin) {
    return <NotFound />;
  }

  return children;
};

export default AdminRoute;