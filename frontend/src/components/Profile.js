import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../utils/passwordValidation';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newPasswordValid, setNewPasswordValid] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');

  useEffect(() => {
    let timeouts = [];
    
    if (profileSuccess) {
      timeouts.push(setTimeout(() => setProfileSuccess(null), 3000));
    }
    if (passwordSuccess) {
      timeouts.push(setTimeout(() => setPasswordSuccess(null), 3000));
    }
    
    return () => timeouts.forEach(timeout => clearTimeout(timeout));
  }, [profileSuccess, passwordSuccess]);

  const validateUsername = (username) => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(username);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retry_after || 3600; // default to 1 hour
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many update attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to update profile');
      }

      updateUser(data.user);
      setProfileSuccess('Profile updated successfully');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      if (!validatePassword(passwordData.newPassword)) {
        throw new Error('New password must be between 6 and 128 characters');
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('New passwords do not match');
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retry_after || 3600;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many password update attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setNewPasswordValid(false);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'newPassword') {
      setNewPasswordValid(validatePassword(value).isValid);
    }
    setPasswordError('');
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setDeleteError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: deleteAccountPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

          {/* Profile Information */}
          <section className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            {profileError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
                <p className="text-red-500">{profileError}</p>
              </div>
            )}
            {profileSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-4">
                <p className="text-green-500">{profileSuccess}</p>
              </div>
            )}
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => {
                    const newUsername = e.target.value.slice(0, 30);
                    if (newUsername === '' || validateUsername(newUsername)) {
                      setProfileData(prev => ({ ...prev, username: newUsername }));
                    }
                  }}
                  maxLength={30}
                  autoComplete="username"
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Only letters, numbers, underscore (_) and hyphen (-) allowed
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 bg-slate-700/30 rounded-lg border border-slate-600 cursor-not-allowed opacity-60"
                />
                <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <button
                type="submit"
                disabled={loading || !profileData.username}
                className={`px-6 py-2 ${
                  loading || !profileData.username
                    ? 'bg-blue-500/50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } rounded-lg transition-colors duration-200`}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </section>

          {/* Password Change */}
          <section className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
                <p className="text-red-500">{passwordError}</p>
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-4">
                <p className="text-green-500">{passwordSuccess}</p>
              </div>
            )}
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-2 bg-slate-700/50 rounded-lg border ${
                    passwordData.newPassword 
                      ? (validatePassword(passwordData.newPassword).isValid ? 'border-green-500' : 'border-red-500') 
                      : 'border-slate-600'
                  } focus:outline-none focus:border-blue-500`}
                />
                {passwordData.newPassword && (
                  <div className="mt-2 space-y-1">
                    {validatePassword(passwordData.newPassword).requirements.map((req, index) => (
                      <p key={index} className={`text-sm ${req.met ? 'text-green-500' : 'text-red-500'}`}>
                        {req.met ? '✓' : '•'} {req.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-2 bg-slate-700/50 rounded-lg border ${
                    passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword
                      ? 'border-green-500'
                      : 'border-slate-600'
                  } focus:outline-none focus:border-blue-500`}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !passwordData.currentPassword || !newPasswordValid || passwordData.newPassword !== passwordData.confirmPassword}
                className={`px-6 py-2 ${
                  loading || !passwordData.currentPassword || !newPasswordValid || passwordData.newPassword !== passwordData.confirmPassword
                    ? 'bg-blue-500/50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } rounded-lg transition-colors duration-200`}
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-500/10 rounded-lg p-6 border border-red-500/50">
            <h2 className="text-xl font-semibold mb-4 text-red-500">Danger Zone</h2>
            <p className="text-gray-400 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
            >
              Delete Account
            </button>
          </section>
        </motion.div>
      </div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4 text-red-500">Delete Account</h3>
              {deleteError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
                  <p className="text-red-500">{deleteError}</p>
                </div>
              )}
              <p className="text-gray-300 mb-4">
                This action cannot be undone. All your lists and data will be permanently deleted.
              </p>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(e) => setDeleteAccountPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || !deleteAccountPassword}
                  className={`flex-1 px-4 py-2 ${
                    loading || !deleteAccountPassword
                      ? 'bg-red-500/50 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  } rounded-lg transition-colors duration-200`}
                >
                  {loading ? 'Deleting...' : 'Delete Account'}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;