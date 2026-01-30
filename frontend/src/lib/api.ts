import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const response = await axios.post(`${API_BASE}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          return api(error.config);
        } catch {
          // Refresh failed, clear tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
    organizationType: 'PAYROLL_PROVIDER' | 'RECORDKEEPER';
  }) => api.post('/auth/register', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    api.patch('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getContributionSummary: (startDate?: string, endDate?: string) =>
    api.get('/dashboard/contributions/summary', { params: { startDate, endDate } }),
  getContributionTrends: (months?: number) =>
    api.get('/dashboard/contributions/trends', { params: { months } }),
  getSyncStatus: () => api.get('/dashboard/sync-status'),
  getAuditLogs: (limit?: number) =>
    api.get('/dashboard/audit-logs', { params: { limit } }),
};

// Employees API
export const employeesApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get('/employees', { params }),
  getById: (id: string) => api.get(`/employees/${id}`),
  create: (data: {
    planId: string;
    employeeNumber: string;
    ssn: string;
    firstName: string;
    lastName: string;
    email?: string;
    hireDate: string;
  }) => api.post('/employees', data),
  update: (id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    status?: string;
  }) => api.patch(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
};

// Contributions API
export const contributionsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; employeeId?: string }) =>
    api.get('/contributions', { params }),
  getById: (id: string) => api.get(`/contributions/${id}`),
  create: (data: {
    employeeId: string;
    payrollDate: string;
    employeePreTax: number;
    employeeRoth?: number;
    employerMatch?: number;
  }) => api.post('/contributions', data),
  validate: (data: {
    employeeId: string;
    payrollDate: string;
    employeePreTax: number;
    employeeRoth?: number;
    employerMatch?: number;
  }) => api.post('/contributions/validate', data),
  getYtd: (employeeId: string, year?: number) =>
    api.get(`/contributions/ytd/${employeeId}`, { params: { year } }),
};

// Integrations API
export const integrationsApi = {
  list: () => api.get('/integrations'),
  getById: (id: string) => api.get(`/integrations/${id}`),
  create: (data: {
    name: string;
    type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
    config: Record<string, unknown>;
  }) => api.post('/integrations', data),
  update: (id: string, data: {
    name?: string;
    config?: Record<string, unknown>;
    status?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  }) => api.patch(`/integrations/${id}`, data),
  triggerSync: (integrationId?: string) => api.post('/integrations/sync', { integrationId }),
};

// Invitations API
export const invitationsApi = {
  list: (params?: { page?: number; status?: string }) =>
    api.get('/invitations', { params }),
  create: (data: { email: string; role?: string }) =>
    api.post('/invitations', data),
  revoke: (id: string) => api.delete(`/invitations/${id}`),
};

// File Uploads API
export const fileUploadsApi = {
  upload: (data: {
    integrationId: string;
    planId: string;
    fileContent: string;
    fileName: string;
  }) => api.post('/file-uploads', data),
  list: (params?: { page?: number; limit?: number; integrationId?: string }) =>
    api.get('/file-uploads', { params }),
  getById: (id: string) => api.get(`/file-uploads/${id}`),
  getTemplate: () => api.get('/file-uploads/template', { responseType: 'blob' }),
};

// Deferral Elections API
export const electionsApi = {
  list: (params?: { page?: number; employeeId?: string; status?: string }) =>
    api.get('/deferral-elections', { params }),
  getActiveForEmployee: (employeeId: string) =>
    api.get(`/deferral-elections/employee/${employeeId}/active`),
  create: (data: {
    employeeId: string;
    preTaxPercent: number;
    rothPercent?: number;
    catchUpPercent?: number;
    effectiveDate: string;
  }) => api.post('/deferral-elections', data),
  update: (id: string, data: {
    preTaxPercent?: number;
    rothPercent?: number;
    status?: string;
  }) => api.patch(`/deferral-elections/${id}`, data),
};
