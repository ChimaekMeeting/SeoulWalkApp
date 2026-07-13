import axios from 'axios';
import { env } from '../config/env';

/* 공용 axios 인스턴스 */
export const client = axios.create({
  baseURL: env.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
