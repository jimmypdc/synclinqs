import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  RefreshCw,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Employees', href: '/employees', icon: Users },
  { name: 'Contributions', href: '/contributions', icon: DollarSign },
  { name: 'Integrations', href: '/integrations', icon: RefreshCw },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { organization, logout } = useAuth();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <span className={styles.logoIcon}>◈</span>
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>SyncLinqs</span>
          <span className={styles.logoTagline}>401(k) Integration</span>
        </div>
      </div>

      {/* Organization */}
      {organization && (
        <div className={styles.orgBadge}>
          <span className={styles.orgLabel}>Organization</span>
          <span className={styles.orgName}>{organization.name}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navigation.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <motion.li
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <NavLink
                  to={item.href}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <item.icon size={18} className={styles.navIcon} />
                  <span className={styles.navText}>{item.name}</span>
                  {isActive && (
                    <motion.div
                      className={styles.activeIndicator}
                      layoutId="activeIndicator"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <ChevronRight size={14} className={styles.navArrow} />
                </NavLink>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.logoutButton} onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <div className={styles.version}>v1.0.0</div>
      </div>
    </aside>
  );
}
