// Central API configuration. Services use localStorage now; set VITE_API_BASE_URL and swap each service's
// internals for fetch(`${API_BASE}/...`) later without touching components. See .env.example.
export const API_BASE = import.meta.env?.VITE_API_BASE_URL || ''
export const USE_API = Boolean(API_BASE)
