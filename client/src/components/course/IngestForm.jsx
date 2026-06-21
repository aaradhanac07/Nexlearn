import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../../hooks/useAxios'
import './IngestForm.css'

export default function IngestForm({ onSuccess }) {
  const api      = useAxios()
  const navigate = useNavigate()
  const [file,           setFile]           = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver,       setDragOver]       = useState(false)

  const handleFile = (f) => {
    if (f && f.type === 'application/pdf') {
      setFile(f)
      setError('')
    } else if (f) {
      setError('Only PDF files are supported')
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      setError('')
      setUploadProgress(0)

      const { data } = await api.post('/api/courses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total))
        }
      })

      onSuccess(data)
      setFile(null)
      setUploadProgress(0)
    } catch (err) {
      const resp = err.response?.data

      // Plan limit hit → redirect to upgrade
      if (err.response?.status === 403 && resp?.upgrade) {
        navigate('/upgrade')
        return
      }

      const msg = resp?.detail || resp?.error || resp?.message || err.message || 'Upload failed. Try again.'
      setError(msg)
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`if-root ${dragOver ? 'if-root--drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
    >
      <div className="if-icon">📄</div>

      <label className="if-label" htmlFor="pdf-upload">
        {file
          ? <span className="if-filename">📎 {file.name}</span>
          : <>
            <span className="if-main-text">Drop a PDF here, or <span className="if-browse">browse</span></span>
            <span className="if-sub-text">Max 50 MB · PDF only</span>
          </>
        }
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          className="if-hidden"
          onChange={e => handleFile(e.target.files[0])}
          disabled={loading}
        />
      </label>

      {/* Progress bar */}
      {loading && (
        <div className="if-progress">
          <div className="if-progress-bar" style={{ width: `${uploadProgress}%` }} />
          <span className="if-progress-label">{uploadProgress < 100 ? `Uploading ${uploadProgress}%` : 'Processing…'}</span>
        </div>
      )}

      {error && (
        <p className="if-error">
          ⚠ {error}
          {error.includes('limit') && (
            <button className="if-upgrade-btn" onClick={() => navigate('/upgrade')}>
              Upgrade to Pro →
            </button>
          )}
        </p>
      )}

      <button
        className="if-submit-btn"
        onClick={handleSubmit}
        disabled={!file || loading}
      >
        {loading ? <><span className="quiz-spinner" /> Processing…</> : '⬆ Upload PDF'}
      </button>
    </div>
  )
}