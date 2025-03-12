export interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  role: 'ADMIN' | 'CONCESSIONNAIRE' | 'UTILISATEUR';
  concessionnaire?: number;
  concessionnaire_name?: string;
  is_active?: boolean;
  plans_count?: number;
}
export interface Concessionnaire extends UserDetails {
  role: 'CONCESSIONNAIRE';
}