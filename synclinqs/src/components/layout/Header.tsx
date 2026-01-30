import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <div className={styles.actions}>
        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchInput}
          />
          <kbd className={styles.searchKbd}>⌘K</kbd>
        </div>

        {/* Notifications */}
        <button className={styles.iconButton}>
          <Bell size={18} />
          <span className={styles.notificationDot} />
        </button>

        {/* User */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user?.firstName} {user?.lastName}
            </span>
            <span className={styles.userRole}>{user?.role}</span>
          </div>
          <div className={styles.userAvatar}>
            <User size={18} />
          </div>
        </div>
      </div>
    </header>
  );
}
