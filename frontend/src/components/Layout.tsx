import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Zap,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Layout.module.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/contributions', icon: DollarSign, label: 'Contributions' },
  { to: '/integrations', icon: Activity, label: 'Integrations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <div className="noise-overlay" />

      {/* Sidebar */}
      <motion.aside
        className={styles.sidebar}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={20} />
          </div>
          <span className={styles.logoText}>SyncLinqs</span>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              <ChevronRight size={14} className={styles.navArrow} />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>
                {user?.firstName} {user?.lastName}
              </span>
              <span className={styles.userOrg}>{user?.organization?.name}</span>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={18} />
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
