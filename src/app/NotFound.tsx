import { Link } from 'react-router-dom'

/**
 * A route that does not exist. Says which one, so a mistyped or stale link is
 * diagnosable rather than mysterious.
 */
export function NotFound() {
  return (
    <div>
      <h1
        style={{
          color: 'var(--ink-900)',
          fontSize: 'var(--text-h1-size)',
          lineHeight: 'var(--text-h1-line)',
          fontWeight: 'var(--weight-bold)',
          marginBottom: 'var(--space-12)',
        }}
      >
        This page does not exist
      </h1>
      <p style={{ marginBottom: 'var(--space-16)' }}>
        <code>{window.location.pathname}</code> is not a route in diGi-Care. It may
        belong to a module that has not been built yet. The sidebar shows which phase
        each one arrives in.
      </p>
      <Link to="/dev/states" style={{ color: 'var(--purple-600)', fontWeight: 600 }}>
        Go to the status states page
      </Link>
    </div>
  )
}
