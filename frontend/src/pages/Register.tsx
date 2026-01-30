import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  Mail,
  Lock,
  User,
  Building,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react';
import { authApi } from '../lib/api';
import styles from './Register.module.css';

export function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organizationName: '',
    organizationType: 'PAYROLL_PROVIDER' as 'PAYROLL_PROVIDER' | 'RECORDKEEPER',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      return 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const { confirmPassword: _, ...registerData } = formData;
      const response = await authApi.register(registerData);
      const { accessToken, refreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      navigate('/');
      window.location.reload();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    const { password } = formData;
    if (!password) return null;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    return strength;
  };

  const strength = passwordStrength();

  return (
    <div className={styles.container}>
      <div className="noise-overlay" />

      {/* Background grid effect */}
      <div className={styles.gridBg} />

      {/* Floating orbs */}
      <motion.div
        className={styles.orb1}
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className={styles.orb2}
        animate={{
          y: [0, 20, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className={styles.header}>
          <motion.div
            className={styles.logoIcon}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <Zap size={28} />
          </motion.div>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>Start managing your 401(k) integrations</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <motion.div
              className={styles.error}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Name fields */}
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label htmlFor="firstName" className={styles.label}>
                First Name
              </label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className={styles.input}
                  required
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="lastName" className={styles.label}>
                Last Name
              </label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className={styles.input}
                  required
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className={styles.input}
                required
              />
            </div>
          </div>

          {/* Organization */}
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label htmlFor="organizationName" className={styles.label}>
                Organization Name
              </label>
              <div className={styles.inputWrapper}>
                <Building size={18} className={styles.inputIcon} />
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className={styles.input}
                  required
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="organizationType" className={styles.label}>
                Organization Type
              </label>
              <select
                id="organizationType"
                name="organizationType"
                value={formData.organizationType}
                onChange={handleChange}
                className={styles.select}
                required
              >
                <option value="PAYROLL_PROVIDER">Payroll Provider</option>
                <option value="RECORDKEEPER">Recordkeeper</option>
              </select>
            </div>
          </div>

          {/* Password */}
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={styles.input}
                required
              />
            </div>
            {formData.password && (
              <div className={styles.strengthBar}>
                <div className={styles.strengthTrack}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`${styles.strengthSegment} ${
                        strength && strength >= level ? styles[`strength${Math.min(strength, 5)}`] : ''
                      }`}
                    />
                  ))}
                </div>
                <span className={styles.strengthText}>
                  {strength && strength < 3 && 'Weak'}
                  {strength === 3 && 'Fair'}
                  {strength === 4 && 'Good'}
                  {strength === 5 && 'Strong'}
                </span>
              </div>
            )}
            <div className={styles.requirements}>
              <span className={formData.password.length >= 8 ? styles.met : ''}>
                <Check size={12} /> 8+ characters
              </span>
              <span className={/[A-Z]/.test(formData.password) ? styles.met : ''}>
                <Check size={12} /> Uppercase
              </span>
              <span className={/[a-z]/.test(formData.password) ? styles.met : ''}>
                <Check size={12} /> Lowercase
              </span>
              <span className={/\d/.test(formData.password) ? styles.met : ''}>
                <Check size={12} /> Number
              </span>
              <span className={/[@$!%*?&]/.test(formData.password) ? styles.met : ''}>
                <Check size={12} /> Special
              </span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={styles.input}
                required
              />
            </div>
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <span className={styles.match}>
                <Check size={14} /> Passwords match
              </span>
            )}
          </div>

          <motion.button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerText}>Already have an account?</span>
          <Link to="/login" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
