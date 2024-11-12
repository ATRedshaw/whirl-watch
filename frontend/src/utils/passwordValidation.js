export const validatePassword = (password) => {
  const minLength = 6;
  const maxLength = 128;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) errors.push(`At least ${minLength} characters`);
  if (password.length > maxLength) errors.push(`Maximum ${maxLength} characters`);
  if (!hasUpperCase) errors.push('One uppercase letter');
  if (!hasLowerCase) errors.push('One lowercase letter');
  if (!hasNumbers) errors.push('One number');
  if (!hasSpecialChar) errors.push('One special character');

  return {
    isValid: errors.length === 0,
    errors,
    requirements: [
      { text: `${minLength}+ characters`, met: password.length >= minLength },
      { text: 'Uppercase letter', met: hasUpperCase },
      { text: 'Lowercase letter', met: hasLowerCase },
      { text: 'Number', met: hasNumbers },
      { text: 'Special character', met: hasSpecialChar }
    ]
  };
}; 