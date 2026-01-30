import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import styles from './Login.module.css';

export function LoginPage() {
  const { isAuthenticated, login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (authLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Decorative background grid */}
      <div className={styles.gridBackground} />

      {/* Left panel - branding */}
      <motion.div
        className={styles.brandPanel}
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className={styles.brandContent}>
          <div className={styles.logoMark}>◈</div>
          <h1 className={styles.brandName}>SyncLinqs</h1>
          <p className={styles.brandTagline}>
            Enterprise-grade 401(k) recordkeeper-payroll integration platform
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>⬡</span>
              <span>Secure data transmission</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>⬡</span>
              <span>Real-time synchronization</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>⬡</span>
              <span>ERISA compliant</span>
            </div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <span className={styles.copyright}>© 2024 SyncLinqs</span>
          <span className={styles.legal}>SOC 2 Type II Certified</span>
        </div>
      </motion.div>

      {/* Right panel - login form */}
      <motion.div
        className={styles.formPanel}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Sign In</h2>
            <p className={styles.formSubtitle}>
              Access your organization's 401(k) integration dashboard
            </p>
          </div>

          {error && (
            <motion.div
              className={styles.errorBanner}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              type="email"
              label="Email Address"
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={18} />}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={18} />}
              required
              autoComplete="current-password"
            />

            <div className={styles.formActions}>
              <label className={styles.rememberMe}>
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className={styles.forgotLink}>
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className={styles.submitButton}
            >
              Sign In
            </Button>
          </form>

          <div className={styles.demoCredentials}>
            <span className={styles.demoLabel}>Demo Credentials</span>
            <code className={styles.demoCode}>
              admin@acmepayroll.com / Admin123!
            </code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
