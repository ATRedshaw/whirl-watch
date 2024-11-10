import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    confirmPassword: '',
    securityQuestion: '',
    securityAnswer: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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

    if (name === 'password') {
      const isValid = value.length >= 6 && value.length <= 128;
      setPasswordValid(isValid);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if ((formData.securityQuestion && !formData.securityAnswer) || 
        (!formData.securityQuestion && formData.securityAnswer)) {
      setError('Both security question and answer must be provided');
      setIsLoading(false);
      return;
    }

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
        password: formData.password,
        security_question: formData.securityQuestion || null,
        security_answer: formData.securityAnswer || null
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
          <p className="text-gray-400">Join WhirlWatch to start tracking movies</p>
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
              className={`w-full bg-slate-800/50 border ${passwordValid ? 'border-green-500' : 'border-red-500'} rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50`}
              required
            />
            <p className={`text-sm ${passwordValid ? 'text-green-500' : 'text-red-500'}`}>
              {passwordValid ? 'Password meets requirements' : 'Password must be at least 6 characters long'}
            </p>
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
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
              required
            />
          </div>

          {/* Security Question Section */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Account Recovery</h3>
            <p className="text-gray-400 mb-4">
              Choose a security question and provide an answer that you'll remember long-term. This information is critical - you won't be able to reset your password without it. Make sure your answer is something only you would know.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Security Question
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="securityQuestion"
                  value={formData.securityQuestion}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    securityQuestion: e.target.value,
                    securityAnswer: e.target.value ? prev.securityAnswer : '' 
                  }))}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Choose a security question</option>
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
                  <option value="first_pet">What was the name of your first pet?</option>
                  <option value="mothers_maiden">What is your mother's maiden name?</option>
                  <option value="elementary_school">What elementary school did you attend?</option>
                  <option value="birth_city">In what city were you born?</option>
                  <option value="first_phone">What was your first phone number?</option>
                  <option value="childhood_vacation">Where did you go on your first vacation?</option>
                  <option value="favorite_book">What was your favorite book as a child?</option>
                  <option value="first_movie">What was the first movie you saw in theaters?</option>
                  <option value="sports_team">What was the first sports team you supported?</option>
                  <option value="childhood_hobby">What was your favorite childhood hobby?</option>
                  <option value="first_computer">What was your first computer or gaming console?</option>
                  <option value="favorite_subject">What was your favorite subject in high school?</option>
                  <option value="first_language">What was the first foreign language you studied?</option>
                  <option value="childhood_dream">What did you want to be when you grew up?</option>
                  <option value="first_award">What was the first award or achievement you remember winning?</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Security Answer
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="securityAnswer"
                  value={formData.securityAnswer}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    securityAnswer: e.target.value 
                  }))}
                  className="w-full px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  required
                  placeholder="Enter an answer you'll always remember"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Your answer must be exact when recovering your account - make it memorable and specific.
                </p>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-700 hover:to-blue-700 transition-colors duration-300 mt-6"
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
                <h3 className="text-xl font-semibold mb-2">Account Created Successfully!</h3>
                <p className="text-gray-400">
                  Redirecting you to login...
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CreateAccount;
