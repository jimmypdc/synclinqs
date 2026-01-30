import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Login.module.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className={styles.title}>SyncLinqs</h1>
          <p className={styles.subtitle}>401(k) Integration Platform</p>
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

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.input}
                required
              />
            </div>
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
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerText}>Don't have an account?</span>
          <Link to="/register" className={styles.footerLink}>
            Create one
          </Link>
        </div>

        {/* Demo credentials */}
        <div className={styles.demo}>
          <span className={styles.demoLabel}>Demo:</span>
          <code className={styles.demoCode}>admin@acmepayroll.com / Admin123!</code>
        </div>
      </motion.div>
    </div>
  );
}
