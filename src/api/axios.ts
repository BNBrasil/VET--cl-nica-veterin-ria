import axios from 'axios';

const api = axios.create({
  baseURL: '/api/vet',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/vet/login';
    }
    return Promise.reject(error);
  }
);

export default api;