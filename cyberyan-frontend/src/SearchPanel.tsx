import { useEffect, useRef, useState } from 'react'
import {
  searchProfiles,
  type Profile,
  type ProfileFilters,
  type SearchResponse,
} from './api'

const PAGE_SIZE = 10

const COLUMNS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'job_title', label: 'Title' },
  { key: 'job_company_name', label: 'Company' },
  { key: 'location_name', label: 'Location' },
  { key: 'industry', label: 'Industry' },
]

function fieldLabel(key: string): string {
  return key.replaceAll('_', ' ')
}

function fieldValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export function ProfileDetail({
  profile,
  onClose,
}: {
  profile: Profile
  onClose: () => void
}) {
  const entries = Object.entries(profile).filter(
    ([key, value]) =>
      key !== 'id' &&
      value !== '' &&
      value != null &&
      !(Array.isArray(value) && value.length === 0),
  )

  return (
    <section className="panel detail">
      <div className="detail-head">
        <h2>{fieldValue(profile.full_name) || `Profile ${profile.id}`}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="detail-grid">
        {entries.map(([key, value]) => (
          <div className="detail-item" key={key}>
            <dt>{fieldLabel(key)}</dt>
            <dd>{fieldValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function SearchPanel({
  refreshKey,
  onSelect,
  filters,
}: {
  refreshKey: number
  onSelect: (profile: Profile) => void
  filters: ProfileFilters
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(q: string, p: number, f: ProfileFilters) {
    setBusy(true)
    setError(null)
    try {
      setResults(
        await searchProfiles({ q, page: p, limit: PAGE_SIZE, filters: f }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  // Load on mount, re-run on new upload or filter change.
  // Filter changes also reset to page 1.
  const prevFilters = useRef(filters)
  useEffect(() => {
    const filtersChanged = prevFilters.current !== filters
    prevFilters.current = filters
    const targetPage = filtersChanged ? 1 : page
    if (filtersChanged) setPage(1)
    void load(query, targetPage, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, filters])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    void load(query, 1, filters)
  }

  function goToPage(p: number) {
    setPage(p)
    void load(query, p, filters)
  }

  return (
    <section className="panel">
      <h2>Search profiles</h2>
      <form className="search-row" onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Search name, title, company, skills…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}

      {results && (
        <>
          <div className="meta">
            {results.total} profile{results.total === 1 ? '' : 's'} found
          </div>
          <table className="results">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.data.map((p) => (
                <tr key={p.id} onClick={() => onSelect(p)} tabIndex={0}>
                  {COLUMNS.map((c) => (
                    <td key={c.key}>{fieldValue(p[c.key]) || '—'}</td>
                  ))}
                </tr>
              ))}
              {results.data.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="empty">
                    No profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {results.total > PAGE_SIZE && (
            <div className="pager">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || busy}
              >
                ← Prev
              </button>
              <span>
                Page {results.page} of{' '}
                {Math.max(1, Math.ceil(results.total / PAGE_SIZE))}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page * PAGE_SIZE >= results.total || busy}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
