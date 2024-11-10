import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    securityAnswer: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [passwordValid, setPasswordValid] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEmailRecovery, setShowEmailRecovery] = useState(false);
  const [emailRecovery, setEmailRecovery] = useState('');
  const [emailRecoveryLoading, setEmailRecoveryLoading] = useState(false);
  const [emailRecoveryError, setEmailRecoveryError] = useState('');
  const [emailRecoverySuccess, setEmailRecoverySuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');

    if (name === 'newPassword') {
      const isValid = value.length >= 6 && value.length <= 128;
      setPasswordValid(isValid);
    }
  };

  // Step 1: Get security question
  const handleGetQuestion = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/get-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username
        })
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {  // Rate limit exceeded
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to get security question');
      }

      setSecurityQuestion(data.security_question);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify security answer
  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          security_answer: formData.securityAnswer
        })
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {  // Rate limit exceeded
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to verify security answer');
      }

      setResetToken(data.reset_token);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword.length > 128) {
      setError('Password must be 128 characters or less');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resetToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setShowSuccessModal(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRecovery = async (e) => {
    e.preventDefault();
    setEmailRecoveryLoading(true);
    setEmailRecoveryError('');
    setEmailRecoverySuccess('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/get-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailRecovery
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {  // Rate limit exceeded
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to recover username');
      }

      setEmailRecoverySuccess(`Your username is: ${data.username}`);
      setTimeout(() => {
        setShowEmailRecovery(false);
        setEmailRecovery('');
        setEmailRecoverySuccess('');
      }, 5000);
    } catch (err) {
      setEmailRecoveryError(err.message);
    } finally {
      setEmailRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Reset Password</h2>
        
        {/* Only show toggle buttons in step 1 */}
        {step === 1 && (
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => setShowEmailRecovery(false)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                !showEmailRecovery ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              I know my username
            </button>
            <button
              onClick={() => setShowEmailRecovery(true)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                showEmailRecovery ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              Forgot username
            </button>
          </div>
        )}

        {showEmailRecovery ? (
          <form onSubmit={handleEmailRecovery} className="space-y-4">
            {emailRecoveryError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg p-3 text-sm"
              >
                {emailRecoveryError}
              </motion.div>
            )}
            
            {emailRecoverySuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-green-500/10 border border-green-500/50 text-green-500 rounded-lg p-3 text-sm"
              >
                {emailRecoverySuccess}
              </motion.div>
            )}

            <div>
              <label className="block text-gray-300 mb-1" htmlFor="recovery-email">
                Email Address
              </label>
              <input
                type="email"
                id="recovery-email"
                value={emailRecovery}
                onChange={(e) => {
                  setEmailRecovery(e.target.value);
                  setEmailRecoveryError('');
                }}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                required
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={emailRecoveryLoading}
              className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
            >
              {emailRecoveryLoading ? 'Checking...' : 'Recover Username'}
            </motion.button>
          </form>
        ) : (
          <>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg p-3 text-sm mb-4"
              >
                {error}
              </motion.div>
            )}
            
            {step === 1 ? (
              <form onSubmit={handleGetQuestion} className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1" htmlFor="reset-username">
                    Username
                  </label>
                  <input
                    type="text"
                    id="reset-username"
                    name="username"
                    autoComplete="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
                >
                  {isLoading ? 'Checking...' : 'Continue'}
                </motion.button>
              </form>
            ) : step === 2 ? (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 mb-4">
                  <p className="text-blue-400">Security Question:</p>
                  <p className="text-gray-300 mt-1">{securityQuestion}</p>
                </div>
                
                <div>
                  <label className="block text-gray-300 mb-1" htmlFor="reset-security-answer">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    id="reset-security-answer"
                    name="securityAnswer"
                    autoComplete="off"
                    value={formData.securityAnswer}
                    onChange={handleChange}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
                >
                  {isLoading ? 'Verifying...' : 'Verify Answer'}
                </motion.button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1" htmlFor="reset-new-password">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="reset-new-password"
                    name="newPassword"
                    autoComplete="new-password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className={`w-full bg-slate-800/50 border ${
                      passwordValid ? 'border-green-500' : 'border-red-500'
                    } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50`}
                    required
                  />
                  <p className={`text-sm ${passwordValid ? 'text-green-500' : 'text-red-500'}`}>
                    {passwordValid ? 'Password meets requirements' : 'Password must be at least 6 characters long'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-gray-300 mb-1" htmlFor="reset-confirm-password">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="reset-confirm-password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </motion.button>
              </form>
            )}
          </>
        )}

        <div className="text-center mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate('/login')}
            className="text-sky-400 hover:text-sky-300"
          >
            Back to Login
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center"
              >
                <svg 
                  className="w-8 h-8 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Password Reset Successfully!</h3>
              <p className="text-gray-400">
                Redirecting you to login...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResetPassword; 