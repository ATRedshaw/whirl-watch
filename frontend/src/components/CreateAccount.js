import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';

const validateUsername = (username) => {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(username);
};

const CreateAccount = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isVerificationSuccess, setIsVerificationSuccess] = useState(false);

  const doPasswordsMatch = () => {
    return formData.password === formData.confirmPassword && formData.confirmPassword !== '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'username') {
      if (value.length > 30) return;
      if (value !== '' && !validateUsername(value)) return;
    }

    setFormData({
      ...formData,
      [name]: value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(formData.password).isValid) {
      setError('Password must meet all complexity requirements');
      return;
    }

    setIsLoading(true);

    if (!validateUsername(formData.username)) {
      setError('Username can only contain letters, numbers, underscore (_) and hyphen (-)');
      setIsLoading(false);
      return;
    }

    if (formData.username.length > 30) {
      setError('Username must be 30 characters or less');
      setIsLoading(false);
      return;
    }

    if (formData.username.length < 1) {
      setError('Username is required');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (formData.password.length > 128) {
      setError('Password must be 128 characters or less');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      
      const requestBody = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };

      const response = await fetch(`${apiUrl}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setVerificationStep(true);
      setUserEmail(formData.email);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e) => {
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
          email: userEmail,
          code: verificationCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setIsVerificationSuccess(true);
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Email verified successfully! You can now log in.' 
          }
        });
      }, 2000);

    } catch (err) {
      setError(err.message);
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
        body: JSON.stringify({ email: userEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification code');
      }

      setError('');
      alert('A new verification code has been sent to your email');

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getVerificationButtonText = () => {
    if (isVerificationSuccess) return 'Verification Successful!';
    if (isLoading) return (
      <span className="flex items-center justify-center">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Verifying...
      </span>
    );
    return 'Verify Email';
  };

  const getVerificationButtonClassName = () => {
    const baseClass = "w-full py-3 rounded-lg font-semibold transition-colors duration-300";
    if (isVerificationSuccess) {
      return `${baseClass} bg-green-600 hover:bg-green-700`;
    }
    return `${baseClass} bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700`;
  };

  if (verificationStep) {
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
            <p className="text-gray-400 mt-2">Email: {userEmail}</p>
            <p className="text-gray-400 mt-2 text-sm italic">
              Don't see the email? Check your spam/junk folder
            </p>
          </div>

          <form onSubmit={handleVerification} className="space-y-4">
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
              disabled={isLoading || isVerificationSuccess}
              className={getVerificationButtonClassName()}
            >
              {getVerificationButtonText()}
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
  }

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
            Create Account
          </h2>
          <p className="text-gray-400">Join WhirlWatch to start tracking your watchlist</p>
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
            <label className="block text-gray-300 mb-1" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Only letters, numbers, underscore (_) and hyphen (-) allowed
            </p>
          </div>

          <div>
            <label className="block text-gray-300 mb-1" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full bg-slate-800/50 border ${
                formData.password 
                  ? (validatePassword(formData.password).isValid ? 'border-green-500' : 'border-red-500') 
                  : 'border-slate-700'
              } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50`}
              required
            />
            {formData.password && (
              <div className="mt-2 space-y-1">
                {validatePassword(formData.password).requirements.map((req, index) => (
                  <p key={index} className={`text-sm ${req.met ? 'text-green-500' : 'text-red-500'}`}>
                    {req.met ? '✓' : '•'} {req.text}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-300 mb-1" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
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
            className={`w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold transition-colors duration-300 mt-6 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:from-sky-700 hover:to-blue-700'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </motion.button>

          <p className="text-center text-gray-400 mt-4">
            Already have an account?{' '}
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/login')}
              className="text-sky-400 hover:text-sky-300"
            >
              Log in
            </motion.button>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateAccount;
