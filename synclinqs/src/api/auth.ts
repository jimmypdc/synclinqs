import { apiClient } from './client';
import type { AuthResponse, User, Organization } from '../types';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationType: 'PAYROLL_PROVIDER' | 'RECORDKEEPER';
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', userData);
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken });
    }
  },

  async getProfile(): Promise<{ user: User; organization: Organization }> {
    const { data } = await apiClient.get('/auth/profile');
    return {
      user: {
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      organization: data.organization,
    };
  },

  async updateProfile(updates: { firstName?: string; lastName?: string }): Promise<User> {
    const { data } = await apiClient.patch('/auth/profile', updates);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },
};
