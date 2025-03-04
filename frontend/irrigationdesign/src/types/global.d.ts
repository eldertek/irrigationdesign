interface InitialState {
  path: string;
  isAuthenticated: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
}
declare global {
  interface Window {
    INITIAL_STATE: InitialState;
  }
}
export {}; 