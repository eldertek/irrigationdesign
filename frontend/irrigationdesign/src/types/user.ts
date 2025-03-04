export interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  role: 'ADMIN' | 'CONCESSIONNAIRE' | 'UTILISATEUR';
  dealer?: number;
  dealer_name?: string;
  is_active?: boolean;
  plans_count?: number;
}
export interface Dealer extends UserDetails {
  role: 'CONCESSIONNAIRE';
}
export interface Client extends UserDetails {
  role: 'UTILISATEUR';
  concessionnaire?: number;
  plans_count: number;
  last_plan_date?: string;
  last_plan_id?: number;
} 