import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@clerk/clerk-react'
import './NotificationBell.css'

export default function NotificationBell() {
  const { getToken } = useAuth()
  const [notes, setNotes]   = useState([])
  const [open, setOpen]     = useState(false)
  const [unread, setUnread] = useState(0)
  const socketRef = useRef(null)
  const panelRef  = useRef(null)

  useEffect(() => {
    let socket
    const connect = async () => {
      try {
        const token   = await getToken()
        const apiUrl  = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
        socket = io(apiUrl, {
          auth:       { token },
          transports: ['websocket'],
          reconnectionAttempts: 3,
          timeout: 5000,
        })
        socketRef.current = socket

        socket.on('notification', (msg) => {
          setNotes(prev => [{ ...msg, id: Date.now(), time: new Date() }, ...prev].slice(0, 20))
          setUnread(u => u + 1)
        })

        socket.on('connect_error', () => {
          // Silent fail — notifications are a nice-to-have
        })
      } catch {
        // Silent fail
      }
    }
    connect()
    return () => { try { socket?.disconnect() } catch {} }
  }, [])

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    setUnread(0)
  }

  return (
    <div className="nb-wrap" ref={panelRef}>
      <button className="nb-btn" onClick={handleOpen} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-header">
            <span>Notifications</span>
            {notes.length > 0 && (
              <button className="nb-clear" onClick={() => setNotes([])}>Clear</button>
            )}
          </div>
          {notes.length === 0 ? (
            <p className="nb-empty">No notifications yet</p>
          ) : (
            <ul className="nb-list">
              {notes.map(n => (
                <li key={n.id} className="nb-item">
                  <span className="nb-item-icon">{n.icon || '📢'}</span>
                  <div>
                    <p className="nb-item-text">{n.message}</p>
                    <p className="nb-item-time">{new Date(n.time).toLocaleTimeString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
