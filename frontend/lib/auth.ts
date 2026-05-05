export const setAuth = (token: string, user: any) => {
  localStorage.setItem('gwt_token', token);
  localStorage.setItem('gwt_user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('gwt_token');
  localStorage.removeItem('gwt_user');
};

export const getToken  = () => (typeof window !== 'undefined' ? localStorage.getItem('gwt_token') : null);
export const getUser   = (): any => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('gwt_user') || 'null'); } catch { return null; }
};
export const isAdmin   = () => getUser()?.role === 'admin';
