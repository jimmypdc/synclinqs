// Auth types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
}

export interface Organization {
  id: string;
  name: string;
  type: 'PAYROLL_PROVIDER' | 'RECORDKEEPER';
  slug?: string;
  billingPlan?: string;
}

export interface AuthResponse {
  user: User;
  organization: Organization;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Employee types
export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  planId: string;
  createdAt: string;
}

// Contribution types
export interface Contribution {
  id: string;
  employeeId: string;
  planId: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayment: number;
  status: 'PENDING' | 'VALIDATED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  createdAt: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
}

// Dashboard types
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalContributions: number;
  pendingContributions: number;
  ytdContributions: number;
  lastSyncAt: string | null;
}

export interface ContributionSummary {
  totalEmployeePreTax: number;
  totalEmployeeRoth: number;
  totalEmployerMatch: number;
  totalEmployerNonMatch: number;
  totalLoanRepayment: number;
  contributionCount: number;
  averageContribution: number;
}

export interface ContributionTrend {
  month: string;
  totalAmount: number;
  contributionCount: number;
}

// Integration types
export interface Integration {
  id: string;
  name: string;
  type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export interface SyncStatus {
  integrations: Integration[];
  pendingJobs: number;
  failedJobs: number;
}

// Deferral Election types
export interface DeferralElection {
  id: string;
  employeeId: string;
  preTaxPercent: number;
  rothPercent: number;
  effectiveDate: string;
  status: 'ACTIVE' | 'PENDING' | 'SUPERSEDED';
}

// Audit Log types
export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    request_id?: string;
  };
}
