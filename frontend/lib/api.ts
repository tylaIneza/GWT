import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gwt_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const url = err.config?.url || '';
      const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/verify');
      if (!isAuthRoute) {
        localStorage.removeItem('gwt_token');
        localStorage.removeItem('gwt_user');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
