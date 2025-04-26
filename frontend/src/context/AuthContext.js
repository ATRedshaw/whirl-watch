import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshToken = async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) return false;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refresh_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  // Verify token and get user data on mount
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
          const response = await fetch(`${apiUrl}/api/verify-token`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else if (response.status === 401) {
            // Token expired, try to refresh
            const refreshed = await refreshToken();
            if (refreshed) {
              // Retry verification with new token
              await verifyToken();
            } else {
              localStorage.removeItem('token');
              localStorage.removeItem('refresh_token');
            }
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (username, password) => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
    const response = await fetch(`${apiUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    navigate('/');
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Make sure both are exported
export default AuthProvider;
