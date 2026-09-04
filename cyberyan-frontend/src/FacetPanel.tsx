import { useEffect, useState } from 'react'
import { getAggregation, type AggregationBucket } from './api'

export const FACETS: { field: string; label: string }[] = [
  { field: 'industry', label: 'Industry' },
  { field: 'location_country', label: 'Country' },
  { field: 'gender', label: 'Gender' },
]

const VISIBLE = 5

export default function FacetPanel({
  refreshKey,
  filters,
  onToggle,
  onClear,
}: {
  refreshKey: number
  filters: Record<string, string | undefined>
  onToggle: (field: string, value: string) => void
  onClear: () => void
}) {
  const [buckets, setBuckets] = useState<Record<string, AggregationBucket[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Re-run whenever a new upload completes
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const results = await Promise.all(
          FACETS.map((f) => getAggregation(f.field)),
        )
        if (cancelled) return
        setBuckets(
          Object.fromEntries(FACETS.map((f, i) => [f.field, results[i]])),
        )
        setError(null)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load filters')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const hasActive = Object.values(filters).some(Boolean)

  return (
    <aside className="facets">
      <div className="facets-head">
        <h2>Filters</h2>
        {hasActive && (
          <button type="button" className="link" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      {FACETS.map((facet) => {
        const list = (buckets[facet.field] ?? []).filter((b) => b.key !== '')
        if (list.length === 0) return null
        const shown = expanded[facet.field] ? list : list.slice(0, VISIBLE)
        return (
          <div className="facet" key={facet.field}>
            <div className="facet-title">{facet.label}</div>
            <div className="facet-chips">
              {shown.map((b) => {
                const active = filters[facet.field] === b.key
                return (
                  <button
                    type="button"
                    key={b.key}
                    className={active ? 'chip active' : 'chip'}
                    onClick={() => onToggle(facet.field, b.key)}
                    title={b.key}
                  >
                    <span className="chip-label">{b.key}</span>
                    <span className="chip-count">{b.doc_count}</span>
                  </button>
                )
              })}
              {list.length > VISIBLE && (
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [facet.field]: !prev[facet.field],
                    }))
                  }
                >
                  {expanded[facet.field]
                    ? 'Show less'
                    : `Show all ${list.length}`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </aside>
  )
}
