interface User {
  id: number;
  username: string;
  user_type: 'admin' | 'concessionnaire' | 'client';
  must_change_password?: boolean;
  concessionnaire?: number;
  concessionnaire_name?: string;
}
interface InitialState {
  path: string;
  isAuthenticated: boolean;
  user: User | null;
}
declare global {
  interface Window {
    INITIAL_STATE: InitialState;
  }
}
export {}; 