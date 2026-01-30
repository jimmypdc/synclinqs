import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Building, Shield, Bell, Key, Save } from 'lucide-react';
import { Header } from '../components/layout';
import { Button, Input, Card, CardHeader, CardContent, CardFooter } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { authApi, getErrorMessage } from '../api';
import styles from './Settings.module.css';

type SettingsTab = 'profile' | 'organization' | 'security' | 'notifications';

export function SettingsPage() {
  const { user, organization, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const profileMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string }) =>
      authApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      setProfileSuccess('Profile updated successfully');
      setProfileError('');
    },
    onError: (error) => {
      setProfileError(getErrorMessage(error));
      setProfileSuccess('');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ current, newPass }: { current: string; newPass: string }) =>
      authApi.changePassword(current, newPass),
    onSuccess: () => {
      setPasswordSuccess('Password changed successfully');
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      setPasswordError(getErrorMessage(error));
      setPasswordSuccess('');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({ firstName, lastName });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({ current: currentPassword, newPass: newPassword });
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'organization' as const, label: 'Organization', icon: Building },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <>
      <Header title="Settings" subtitle="Manage your account and preferences" />

      <div className={styles.content}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card padding="lg">
                <CardHeader
                  title="Profile Information"
                  subtitle="Update your personal details"
                />
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className={styles.form}>
                    <div className={styles.formRow}>
                      <Input
                        label="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                      <Input
                        label="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                    <Input
                      label="Email Address"
                      value={user?.email || ''}
                      disabled
                      hint="Contact support to change your email"
                    />
                    <Input
                      label="Role"
                      value={user?.role || ''}
                      disabled
                    />

                    {profileError && (
                      <div className={styles.errorMessage}>{profileError}</div>
                    )}
                    {profileSuccess && (
                      <div className={styles.successMessage}>{profileSuccess}</div>
                    )}
                  </form>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="primary"
                    leftIcon={<Save size={14} />}
                    onClick={handleProfileSubmit}
                    isLoading={profileMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* Organization Tab */}
          {activeTab === 'organization' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card padding="lg">
                <CardHeader
                  title="Organization Settings"
                  subtitle="View your organization details"
                />
                <CardContent>
                  <div className={styles.form}>
                    <Input
                      label="Organization Name"
                      value={organization?.name || ''}
                      disabled
                    />
                    <Input
                      label="Organization Type"
                      value={organization?.type?.replace('_', ' ') || ''}
                      disabled
                    />
                    <Input
                      label="Billing Plan"
                      value={organization?.billingPlan || 'Trial'}
                      disabled
                    />

                    <div className={styles.infoBox}>
                      <Key size={16} />
                      <span>Contact support to modify organization settings</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card padding="lg">
                <CardHeader
                  title="Change Password"
                  subtitle="Update your account password"
                />
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className={styles.form}>
                    <Input
                      type="password"
                      label="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <Input
                      type="password"
                      label="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      hint="Must be at least 8 characters"
                      autoComplete="new-password"
                    />
                    <Input
                      type="password"
                      label="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />

                    {passwordError && (
                      <div className={styles.errorMessage}>{passwordError}</div>
                    )}
                    {passwordSuccess && (
                      <div className={styles.successMessage}>{passwordSuccess}</div>
                    )}
                  </form>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="primary"
                    leftIcon={<Shield size={14} />}
                    onClick={handlePasswordSubmit}
                    isLoading={passwordMutation.isPending}
                  >
                    Update Password
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card padding="lg">
                <CardHeader
                  title="Notification Preferences"
                  subtitle="Manage how you receive updates"
                />
                <CardContent>
                  <div className={styles.notificationList}>
                    <label className={styles.notificationItem}>
                      <div className={styles.notificationInfo}>
                        <span className={styles.notificationTitle}>Sync Alerts</span>
                        <span className={styles.notificationDesc}>
                          Receive notifications when sync jobs complete or fail
                        </span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className={styles.notificationItem}>
                      <div className={styles.notificationInfo}>
                        <span className={styles.notificationTitle}>Weekly Reports</span>
                        <span className={styles.notificationDesc}>
                          Get weekly summary of contribution activity
                        </span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className={styles.notificationItem}>
                      <div className={styles.notificationInfo}>
                        <span className={styles.notificationTitle}>Security Alerts</span>
                        <span className={styles.notificationDesc}>
                          Important security notifications and login alerts
                        </span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="primary" leftIcon={<Save size={14} />}>
                    Save Preferences
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
