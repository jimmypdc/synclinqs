import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  User,
  Building,
  Users,
  Mail,
  Shield,
  Bell,
  Key,
  Trash2,
  Plus,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { invitationsApi, authApi } from '../lib/api';
import styles from './Settings.module.css';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export function Settings() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');
  const [copied, setCopied] = useState<string | null>(null);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Sync profile state when user changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  const { data: invitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list().then((r) => r.data),
    enabled: activeTab === 'team',
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      invitationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setInviteEmail('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => invitationsApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string }) =>
      authApi.updateProfile(data),
    onSuccess: async () => {
      setProfileSuccess(true);
      setProfileError('');
      await refreshUser();
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      setProfileError(error.response?.data?.error?.message || 'Failed to update profile');
      setProfileSuccess(false);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      setPasswordError(error.response?.data?.error?.message || 'Failed to change password');
      setPasswordSuccess(false);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    profileMutation.mutate({ firstName, lastName });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      setPasswordError('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'organization', label: 'Organization', icon: Building },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account and preferences</p>
      </div>

      <div className={styles.layout}>
        {/* Sidebar */}
        <nav className={styles.sidebar}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Profile Information</h2>
                <form onSubmit={handleProfileSave} className={styles.form}>
                  {profileSuccess && (
                    <div className={styles.successMessage}>
                      <Check size={16} />
                      Profile updated successfully
                    </div>
                  )}
                  {profileError && (
                    <div className={styles.errorMessage}>
                      <AlertCircle size={16} />
                      {profileError}
                    </div>
                  )}
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>First Name</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Last Name</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email</label>
                    <input
                      type="email"
                      className={styles.input}
                      defaultValue={user?.email}
                      disabled
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Role</label>
                    <input
                      type="text"
                      className={styles.input}
                      defaultValue={user?.role}
                      disabled
                    />
                  </div>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={profileMutation.isPending}
                  >
                    {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'organization' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Organization Details</h2>
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Organization Name</label>
                    <input
                      type="text"
                      className={styles.input}
                      defaultValue={user?.organization?.name}
                      disabled
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Organization ID</label>
                    <div className={styles.copyField}>
                      <code className={styles.codeField}>{user?.organization?.id}</code>
                      <button
                        className={styles.copyBtn}
                        onClick={() => copyToClipboard(user?.organization?.id || '', 'org-id')}
                      >
                        {copied === 'org-id' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Invite Team Member</h2>
                <form onSubmit={handleInvite} className={styles.inviteForm}>
                  <div className={styles.inviteInputs}>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                      <input
                        type="email"
                        placeholder="Email address"
                        className={styles.input}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <select
                      className={styles.select}
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                      <option value="READONLY">Read Only</option>
                    </select>
                    <button
                      type="submit"
                      className={styles.inviteBtn}
                      disabled={inviteMutation.isPending}
                    >
                      <Plus size={16} />
                      Invite
                    </button>
                  </div>
                </form>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Pending Invitations</h2>
                <div className={styles.inviteList}>
                  {invitations?.data?.length === 0 ? (
                    <div className={styles.emptyInvites}>
                      <Mail size={24} />
                      <span>No pending invitations</span>
                    </div>
                  ) : (
                    invitations?.data?.map((invite: Invitation) => (
                      <div key={invite.id} className={styles.inviteItem}>
                        <div className={styles.inviteInfo}>
                          <span className={styles.inviteEmail}>{invite.email}</span>
                          <span className={styles.inviteRole}>{invite.role}</span>
                        </div>
                        <div className={styles.inviteActions}>
                          <span className={`${styles.inviteStatus} ${styles[invite.status.toLowerCase()]}`}>
                            {invite.status}
                          </span>
                          {invite.status === 'pending' && (
                            <button
                              className={styles.revokeBtn}
                              onClick={() => revokeMutation.mutate(invite.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Change Password</h2>
                <form onSubmit={handlePasswordChange} className={styles.form}>
                  {passwordSuccess && (
                    <div className={styles.successMessage}>
                      <Check size={16} />
                      Password changed successfully
                    </div>
                  )}
                  {passwordError && (
                    <div className={styles.errorMessage}>
                      <AlertCircle size={16} />
                      {passwordError}
                    </div>
                  )}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Current Password</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>New Password</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <span className={styles.hint}>
                      Must be 8+ characters with uppercase, lowercase, number, and special character
                    </span>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Confirm New Password</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={passwordMutation.isPending}
                  >
                    <Key size={16} />
                    {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Email Notifications</h2>
                <div className={styles.toggleList}>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleSlider} />
                    <div className={styles.toggleLabel}>
                      <span>Sync Notifications</span>
                      <span className={styles.toggleDesc}>
                        Receive emails when syncs complete or fail
                      </span>
                    </div>
                  </label>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleSlider} />
                    <div className={styles.toggleLabel}>
                      <span>Validation Errors</span>
                      <span className={styles.toggleDesc}>
                        Get notified about contribution validation issues
                      </span>
                    </div>
                  </label>
                  <label className={styles.toggle}>
                    <input type="checkbox" />
                    <span className={styles.toggleSlider} />
                    <div className={styles.toggleLabel}>
                      <span>Weekly Summary</span>
                      <span className={styles.toggleDesc}>
                        Weekly digest of contribution activity
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
