export type UserRole = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  role: UserRole;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}
export interface ApiError {
  statusCode?: number;
  message?: string | string[];
}
