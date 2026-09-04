export interface Profile {
  id: string
  full_name?: string
  first_name?: string
  last_name?: string
  gender?: string
  job_title?: string
  job_company_name?: string
  job_company_industry?: string
  location_name?: string
  location_country?: string
  linkedin_url?: string
  linkedin_connections?: number
  inferred_salary?: number
  inferred_years_experience?: number
  summary?: string
  [key: string]: unknown
}

export interface SearchResponse {
  data: Profile[]
  total: number
  page: number
  limit: number
}

export interface InvalidRow {
  row: number
  reason: string
  preview: string
}

export interface UploadResult {
  message: string
  stored: number
  indexed: number
  failed: number
  errors: { reason: string; count: number }[]
  invalidRows: InvalidRow[]
  invalidCount: number
  repairedCount: number
}

// Empty base = same origin (Vite proxies /api to the backend in dev).
// Override with VITE_API_URL for a separately hosted backend.
const BASE: string = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null
    const detail =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join('; ')
          : res.statusText
    throw new Error(`${res.status} — ${detail}`)
  }
  return (await res.json()) as T
}

export interface AggregationBucket {
  key: string
  doc_count: number
}

export interface ProfileFilters {
  industry?: string
  location_country?: string
  gender?: string
  [key: string]: string | undefined
}

export function getAggregation(
  field: string,
): Promise<AggregationBucket[]> {
  return request<AggregationBucket[]>(
    `/api/profiles/aggregations/${encodeURIComponent(field)}`,
  )
}

export function searchProfiles(params: {
  q?: string
  page?: number
  limit?: number
  filters?: ProfileFilters
}): Promise<SearchResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 10))
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value) query.set(key, value)
  }
  return request<SearchResponse>(`/api/profiles/search?${query}`)
}

export function uploadCsv(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return request<UploadResult>('/api/profiles/upload-csv', {
    method: 'POST',
    body: form,
  })
}
