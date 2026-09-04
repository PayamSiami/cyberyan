import { useState } from 'react'
import UploadPanel from './UploadPanel'
import SearchPanel from './SearchPanel'
import { ProfileDetail } from './SearchPanel'
import FacetPanel from './FacetPanel'
import type { Profile, ProfileFilters } from './api'
import './App.css'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [filters, setFilters] = useState<ProfileFilters>({})

  function toggleFilter(field: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev }
      if (next[field] === value) {
        delete next[field]
      } else {
        next[field] = value
      }
      return next
    })
  }

  if (selected) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Cyberyan</h1>
        </header>
        <ProfileDetail profile={selected} onClose={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cyberyan</h1>
        <p>LinkedIn profile search — import a CSV, then explore the data.</p>
      </header>

      <div className="layout">
        <FacetPanel
          refreshKey={refreshKey}
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters({})}
        />
        <main className="main-col">
          <UploadPanel onUploaded={() => setRefreshKey((k) => k + 1)} />
          <SearchPanel
            refreshKey={refreshKey}
            onSelect={setSelected}
            filters={filters}
          />
        </main>
      </div>

      <footer className="app-footer">
        Backend: <code>POST /api/profiles/upload-csv</code> ·{' '}
        <code>GET /api/profiles/search</code> ·{' '}
        <code>GET /api/profiles/aggregations/:field</code>
      </footer>
    </div>
  )
}
