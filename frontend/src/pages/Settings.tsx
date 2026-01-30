import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { invitationsApi } from '../lib/api';
import styles from './Settings.module.css';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');
  const [copied, setCopied] = useState<string | null>(null);

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
    }
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
                <div className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>First Name</label>
                      <input
                        type="text"
                        className={styles.input}
                        defaultValue={user?.firstName}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Last Name</label>
                      <input
                        type="text"
                        className={styles.input}
                        defaultValue={user?.lastName}
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
                  <button className={styles.saveBtn}>Save Changes</button>
                </div>
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
                  <button className={styles.saveBtn}>Save Changes</button>
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
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Current Password</label>
                    <input type="password" className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>New Password</label>
                    <input type="password" className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Confirm New Password</label>
                    <input type="password" className={styles.input} />
                  </div>
                  <button className={styles.saveBtn}>
                    <Key size={16} />
                    Update Password
                  </button>
                </div>
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
