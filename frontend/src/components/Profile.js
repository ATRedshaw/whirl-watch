import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

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
  const [showSecurityQuestionModal, setShowSecurityQuestionModal] = useState(false);
  
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

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    securityQuestion: '',
    securityAnswer: ''
  });
  const [error, setError] = useState('');

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
    
    if (!validateUsername(profileData.username)) {
      setProfileError('Username can only contain letters, numbers, underscore (_) and hyphen (-)');
      return;
    }

    if (profileData.username.length > 30) {
      setProfileError('Username must be 30 characters or less');
      return;
    }

    if (profileData.username.length < 1) {
      setProfileError('Username is required');
      return;
    }

    setLoading(true);
    setProfileError(null);
    setProfileSuccess(null);

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
        if (response.status === 401) {
          logout();
          navigate('/login');
          throw new Error('Session expired. Please log in again.');
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
    
    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (passwordData.newPassword.length > 128) {
      setPasswordError('New password must be 128 characters or less');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
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
        if (response.status === 401) {
          logout();
          navigate('/login');
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setLoading(false);
    }
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

  const handleRemoveSecurityQuestion = async () => {
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/user/security-question`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          remove: true
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      updateUser({
        ...user,
        security_question: null
      });
      
      setProfileSuccess('Security question removed successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSecurityQuestion = async () => {
    setLoading(true);
    setError('');

    // Validate inputs
    if (!securityData.currentPassword) {
      setError('Current password is required');
      setLoading(false);
      return;
    }

    if ((securityData.securityQuestion && !securityData.securityAnswer) || 
        (!securityData.securityQuestion && securityData.securityAnswer)) {
      setError('Both security question and answer must be provided');
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/user/security-question`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: securityData.currentPassword,
          security_question: securityData.securityQuestion,
          security_answer: securityData.securityAnswer.trim()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update security question');
      }

      updateUser({
        ...user,
        security_question: securityData.securityQuestion
      });

      setShowSecurityQuestionModal(false);
      setSecurityData({
        currentPassword: '',
        securityQuestion: '',
        securityAnswer: ''
      });
      setProfileSuccess('Security question updated successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className={`px-6 py-2 ${
                  loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword
                    ? 'bg-blue-500/50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } rounded-lg transition-colors duration-200`}
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Security Question Section */}
          <section className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Account Recovery</h2>
            
            {user?.security_question ? (
              <>
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 mb-4">
                  <p className="text-blue-400">
                    You have a security question set up. This allows you to reset your password if you forget it.
                  </p>
                  <p className="text-gray-400 mt-2">
                    Current question: {
                      {
                        'childhood_hero': 'Who was your childhood hero or role model?',
                        'first_concert': 'What was the first concert you attended?',
                        'childhood_nickname': 'What was your childhood nickname?',
                        'first_job': 'What was your first paid job?',
                        'favorite_teacher': 'What was the name of your favorite teacher?',
                        'first_car': 'What was the make/model of your first car?',
                        'met_spouse': 'In what city did you meet your spouse/significant other?',
                        'grandparent_occupation': 'What was your maternal grandfather\'s occupation?',
                        'childhood_street': 'What street did you live on in third grade?',
                        'childhood_bestfriend': 'What was the name of your childhood best friend?'
                      }[user.security_question] || user.security_question
                    }
                  </p>
                </div>
                <button
                  onClick={handleRemoveSecurityQuestion}
                  disabled={loading}
                  className={`px-6 py-2 ${
                    loading 
                      ? 'bg-red-500/50 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  } rounded-lg transition-colors duration-200`}
                >
                  {loading ? 'Removing...' : 'Remove Security Question'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4">
                  <p className="text-yellow-500">
                    You haven't set up a security question. Without this, you won't be able to reset your password if you forget it.
                  </p>
                </div>
                <button
                  onClick={() => setShowSecurityQuestionModal(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                >
                  Set Up Security Question
                </button>
              </>
            )}
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

      {/* Add modal for setting up security question */}
      <AnimatePresence>
        {showSecurityQuestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowSecurityQuestionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Set Up Security Question</h3>
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
                  <p className="text-red-500">{error}</p>
                </div>
              )}
              <p className="text-gray-300 mb-4">
                This security question will help you recover your account if you forget your password.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={securityData.currentPassword}
                    onChange={(e) => setSecurityData(prev => ({ 
                      ...prev, 
                      currentPassword: e.target.value 
                    }))}
                    className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Security Question
                  </label>
                  <select
                    value={securityData.securityQuestion}
                    onChange={(e) => setSecurityData(prev => ({ 
                      ...prev, 
                      securityQuestion: e.target.value 
                    }))}
                    className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select a security question</option>
                    <option value="childhood_hero">Who was your childhood hero or role model?</option>
                    <option value="first_concert">What was the first concert you attended?</option>
                    <option value="childhood_nickname">What was your childhood nickname?</option>
                    <option value="first_job">What was your first paid job?</option>
                    <option value="favorite_teacher">What was the name of your favorite teacher?</option>
                    <option value="first_car">What was the make/model of your first car?</option>
                    <option value="met_spouse">In what city did you meet your spouse/significant other?</option>
                    <option value="grandparent_occupation">What was your maternal grandfather's occupation?</option>
                    <option value="childhood_street">What street did you live on in third grade?</option>
                    <option value="childhood_bestfriend">What was the name of your childhood best friend?</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Security Answer
                  </label>
                  <input
                    type="text"
                    value={securityData.securityAnswer}
                    onChange={(e) => setSecurityData(prev => ({ 
                      ...prev, 
                      securityAnswer: e.target.value 
                    }))}
                    className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleUpdateSecurityQuestion}
                    disabled={loading || !securityData.currentPassword || !securityData.securityQuestion || !securityData.securityAnswer}
                    className={`flex-1 px-4 py-2 ${
                      loading || !securityData.currentPassword || !securityData.securityQuestion || !securityData.securityAnswer
                        ? 'bg-blue-500/50 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } rounded-lg transition-colors duration-200`}
                  >
                    {loading ? 'Updating...' : 'Save Security Question'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSecurityQuestionModal(false);
                      setSecurityData({
                        currentPassword: '',
                        securityQuestion: '',
                        securityAnswer: ''
                      });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;