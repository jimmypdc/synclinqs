import { apiClient } from './client';
import type { Employee, PaginatedResponse } from '../types';

interface EmployeeFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

interface CreateEmployeeData {
  employeeNumber: string;
  ssn: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  planId: string;
}

interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
}

export const employeesApi = {
  async list(filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>> {
    const { data } = await apiClient.get('/employees', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Employee> {
    const { data } = await apiClient.get(`/employees/${id}`);
    return data;
  },

  async create(employeeData: CreateEmployeeData): Promise<Employee> {
    const { data } = await apiClient.post('/employees', employeeData);
    return data;
  },

  async update(id: string, updates: UpdateEmployeeData): Promise<Employee> {
    const { data } = await apiClient.patch(`/employees/${id}`, updates);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/employees/${id}`);
  },
};
