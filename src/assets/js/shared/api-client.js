// ============================================
// API Client - Cybhor Tech Portal
// ============================================
// Wrapper fino sobre fetch() que centraliza a URL base, o envio de
// cookies httpOnly (credentials: 'include') e o tratamento de erros
// da API REST. Substitui as chamadas diretas ao SDK do Firebase.

import { API_BASE_URL } from './config.js';

export class ApiError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request(method, path, { body, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  // Alguns proxies/navegadores podem devolver 304 sem corpo; tratamos como falha
  // recuperável forçando o caller a tentar de novo com cache desabilitado.
  if (response.status === 304) {
    throw new ApiError('Resposta em cache inválida. Recarregue a página.', 304);
  }

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      (data && data.error) || `Erro ao comunicar com o servidor (${response.status}).`,
      response.status,
      data && data.details
    );
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, { body: formData, isFormData: true })
};
