import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtext?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  subtext,
  variant = 'default',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      className={`${styles.card} ${styles[variant]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <div className={styles.iconWrapper}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className={styles.valueWrapper}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span className={`${styles.trend} ${trend.isPositive ? styles.positive : styles.negative}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtext && <span className={styles.subtext}>{subtext}</span>}

      {/* Decorative corner accent */}
      <div className={styles.cornerAccent} />
    </motion.div>
  );
}
