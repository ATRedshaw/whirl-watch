import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  // Step 1: Request verification code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to send verification code');
      }

      if (data.status === 'code_sent') {
        setStep(2);
      } else if (data.status === 'no_account') {
        setError('No account found with this email address');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.verificationCode
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Invalid verification code');
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

    if (!validatePassword(formData.newPassword).isValid) {
      setError('Password must meet all complexity requirements');
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

  // Add this new function after your existing handlers
  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const response = await fetch(`${apiUrl}/api/reset-password/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retry_after || 900;
          const minutes = Math.ceil(retryAfter / 60);
          throw new Error(
            `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
          );
        }
        throw new Error(data.error || 'Failed to resend verification code');
      }

      // Show success message
      setError('New verification code sent!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this helper function near the top with other functions
  const doPasswordsMatch = () => {
    return formData.newPassword === formData.confirmPassword && formData.confirmPassword !== '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Reset Password</h2>
        
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
          // Step 1: Enter Email
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-1" htmlFor="reset-email">
                Email Address
              </label>
              <input
                type="email"
                id="reset-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </motion.button>
          </form>
        ) : step === 2 ? (
          // Step 2: Enter Verification Code
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 mb-4">
              <p className="text-blue-400">Verification code sent!</p>
              <p className="text-gray-300 mt-1">Please check your email for the verification code.</p>
              <p className="text-gray-400 mt-2 text-sm italic">
                Don't see the email? Check your spam/junk folder
              </p>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 transition-colors duration-200"
              >
                Resend verification code
              </button>
            </div>
            
            <div>
              <label className="block text-gray-300 mb-1" htmlFor="verification-code">
                Verification Code
              </label>
              <input
                type="text"
                id="verification-code"
                value={formData.verificationCode}
                onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                maxLength={6}
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
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </motion.button>
          </form>
        ) : (
          // Step 3: Set New Password (keep existing password reset form)
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
                  formData.newPassword 
                    ? (validatePassword(formData.newPassword).isValid ? 'border-green-500' : 'border-red-500') 
                    : 'border-slate-700'
                } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50`}
                required
              />
              {formData.newPassword && (
                <div className="mt-2 space-y-1">
                  {validatePassword(formData.newPassword).requirements.map((req, index) => (
                    <p key={index} className={`text-sm ${req.met ? 'text-green-500' : 'text-red-500'}`}>
                      {req.met ? '✓' : '•'} {req.text}
                    </p>
                  ))}
                </div>
              )}
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
                className={`w-full bg-slate-800/50 border ${
                  formData.confirmPassword 
                    ? (doPasswordsMatch() ? 'border-green-500' : 'border-red-500') 
                    : 'border-slate-700'
                } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50`}
                required
              />
              {formData.confirmPassword && !doPasswordsMatch() && (
                <p className="text-sm text-red-500 mt-1">Passwords do not match</p>
              )}
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