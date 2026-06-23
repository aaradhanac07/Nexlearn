import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import './AppShell.css'

/**
 * AppShell — wraps all authenticated pages.
 * Renders the fixed floating Navbar and a scrollable main content area.
 */
export default function AppShell() {
  return (
    <div className="shell-root">
      <Navbar />
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
