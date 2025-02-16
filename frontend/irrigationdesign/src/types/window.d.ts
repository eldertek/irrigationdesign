interface User {
  id: number;
  username: string;
  user_type: 'admin' | 'dealer' | 'client';
  must_change_password?: boolean;
  dealer?: number;
  dealer_name?: string;
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