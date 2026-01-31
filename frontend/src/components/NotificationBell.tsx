import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import { notificationsApi } from '../lib/api';
import styles from './NotificationBell.module.css';

interface Notification {
  id: string;
  notificationType: string;
  severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

const severityIcons = {
  critical: AlertCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const severityColors = {
  critical: 'var(--accent-error)',
  error: 'var(--accent-error)',
  warning: 'var(--accent-warning)',
  info: 'var(--accent-primary)',
  success: 'var(--accent-success)',
};

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery({
    queryKey: ['notification-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 10 }).then((r) => r.data),
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = countData?.data?.count ?? 0;
  const notifications: Notification[] = notificationsData?.data ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.bellBtn}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.header}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className={styles.markAllBtn}
                  onClick={() => markAllReadMutation.mutate()}
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>

            <div className={styles.list}>
              {notifications.length === 0 ? (
                <div className={styles.empty}>
                  <Bell size={32} />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = severityIcons[notification.severity] || Info;
                  return (
                    <div
                      key={notification.id}
                      className={`${styles.item} ${!notification.isRead ? styles.unread : ''}`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markReadMutation.mutate(notification.id);
                        }
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl;
                        }
                      }}
                    >
                      <div
                        className={styles.iconWrapper}
                        style={{ color: severityColors[notification.severity] }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className={styles.content}>
                        <span className={styles.title}>{notification.title}</span>
                        <span className={styles.message}>{notification.message}</span>
                        <span className={styles.time}>{formatTime(notification.createdAt)}</span>
                      </div>
                      {!notification.isRead && <div className={styles.unreadDot} />}
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className={styles.footer}>
                <button className={styles.viewAllBtn} onClick={() => setIsOpen(false)}>
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
