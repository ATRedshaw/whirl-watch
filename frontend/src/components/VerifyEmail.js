import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Get email from location state (passed during navigation)
    const emailFromState = location.state?.email;
    if (!emailFromState) {
      navigate('/login');
      return;
    }
    setEmail(emailFromState);
  }, [location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      
      const response = await fetch(`${apiUrl}/api/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          code: verificationCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      // Show success message and redirect
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Email verified successfully! You can now log in.' 
          }
        });
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      
      const response = await fetch(`${apiUrl}/api/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification code');
      }

      setError(''); // Clear any existing errors
      // Show success message
      alert('A new verification code has been sent to your email');

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-500 to-purple-600">
            Verify Your Email
          </h2>
          <p className="text-gray-400">Please check your email for the verification code</p>
          <p className="text-gray-400 mt-2">Email: {email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg p-3 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label className="block text-gray-300 mb-1" htmlFor="verificationCode">
              Verification Code
            </label>
            <input
              type="text"
              id="verificationCode"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
              placeholder="Enter 6-digit code"
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
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Email'
            )}
          </motion.button>

          <div className="text-center mt-4">
            <p className="text-gray-400">
              Didn't receive the code?{' '}
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleResendCode}
                disabled={isLoading}
                type="button"
                className="text-sky-400 hover:text-sky-300"
              >
                Resend Code
              </motion.button>
            </p>
          </div>

          <div className="text-center mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/login')}
              className="text-sky-400 hover:text-sky-300"
              type="button"
            >
              Back to Login
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
