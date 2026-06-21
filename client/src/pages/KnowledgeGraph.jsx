import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import '../styles/knowledge-graph.css'

import ForceGraph2D from 'react-force-graph-2d'

const MASTERY_COLOR = (pct) => {
  if (pct >= 75) return '#10b981' // green
  if (pct >= 40) return '#f59e0b' // amber
  return '#ef4444'                // red
}

export default function KnowledgeGraph() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const api = useAxios()

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [error, setError]         = useState('')
  const fgRef = useRef()

  useEffect(() => {
    loadGraph()
  }, [courseId])

  const loadGraph = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/api/quiz/knowledge-graph/${courseId}`)
      setGraphData(formatGraph(data))
    } catch (e) {
      if (e.response?.status === 404) {
        setError('not_generated')
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const generateGraph = async () => {
    setGenerating(true)
    setError('')
    try {
      // First fetch the course to get its text (use summary as proxy)
      const { data: course } = await api.get(`/api/courses/${courseId}`)
      const fullText = [course.title, course.description, course.summary, ...(course.concepts || [])].join('\n\n')

      const { data } = await api.post(`/api/quiz/knowledge-graph/${courseId}`, { fullText })
      setGraphData(formatGraph(data))
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setGenerating(false)
    }
  }

  function formatGraph(data) {
    const nodes = (data.nodes || []).map(n => ({
      id:         n.id,
      label:      n.label,
      conceptTag: n.conceptTag,
      description: n.description,
      masteryPct: n.masteryPct || 0,
      color:      MASTERY_COLOR(n.masteryPct || 0),
      val:        6
    }))

    const links = (data.edges || []).map(e => ({
      source:   e.source,
      target:   e.target,
      relation: e.relation,
      color:    'rgba(148,163,184,0.4)'
    }))

    return { nodes, links }
  }

  const handleNodeClick = useCallback(node => {
    setSelected(node)
    fgRef.current?.centerAt(node.x, node.y, 500)
    fgRef.current?.zoom(2.5, 500)
  }, [])

  if (loading) return (
    <div className="kg-root">
      <div className="kg-header">
        <button className="fc-back" onClick={() => navigate(`/courses/${courseId}`)}>← Back</button>
        <h1 className="kg-title">Knowledge Graph</h1>
      </div>
      <div className="kg-loading"><div className="fc-spinner" /><p>Loading graph...</p></div>
    </div>
  )

  return (
    <div className="kg-root">
      <div className="kg-header">
        <button className="fc-back" onClick={() => navigate(`/courses/${courseId}`)}>← Back</button>
        <h1 className="kg-title">Knowledge Graph</h1>
        <div className="kg-legend">
          <span className="kg-legend-dot" style={{ background: '#10b981' }} />High mastery
          <span className="kg-legend-dot" style={{ background: '#f59e0b' }} />Medium
          <span className="kg-legend-dot" style={{ background: '#ef4444' }} />Needs work
        </div>
      </div>

      {(error === 'not_generated' || graphData.nodes.length === 0) ? (
        <div className="kg-empty">
          <div className="kg-empty-icon">🕸️</div>
          <h2>No knowledge graph yet</h2>
          <p>Generate a visual map of concepts and how they connect</p>
          <button className="quiz-start-btn" onClick={generateGraph} disabled={generating}>
            {generating ? <><span className="quiz-spinner" /> Generating...</> : '✨ Generate Knowledge Graph'}
          </button>
          {error && error !== 'not_generated' && <p className="quiz-error">{error}</p>}
        </div>
      ) : (
        <div className="kg-canvas-wrapper">
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel={node => `${node.label} (${node.masteryPct}% mastery)`}
            nodeColor={node => node.color}
            nodeVal={node => node.val}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label
              const fontSize = 12 / globalScale
              ctx.font = `${fontSize}px Inter, sans-serif`
              const radius = Math.sqrt(node.val) * 4

              // Circle
              ctx.beginPath()
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
              ctx.fillStyle = node.color
              ctx.fill()
              ctx.strokeStyle = node === selected ? '#ffffff' : 'rgba(255,255,255,0.3)'
              ctx.lineWidth = node === selected ? 2 : 1
              ctx.stroke()

              // Label
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillStyle = '#ffffff'
              ctx.fillText(label, node.x, node.y + radius + fontSize + 2)
            }}
            linkLabel={link => link.relation}
            linkColor={link => link.color}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkWidth={1.5}
            onNodeClick={handleNodeClick}
            backgroundColor="#0f172a"
            width={window.innerWidth - (selected ? 320 : 0)}
          />

          {selected && (
            <div className="kg-detail-panel">
              <button className="kg-close" onClick={() => setSelected(null)}>✕</button>
              <h3 className="kg-detail-title">{selected.label}</h3>
              <div className="kg-mastery-bar-wrap">
                <span>Mastery</span>
                <div className="kg-mastery-bar">
                  <div className="kg-mastery-fill" style={{ width: `${selected.masteryPct}%`, background: selected.color }} />
                </div>
                <span>{selected.masteryPct}%</span>
              </div>
              {selected.description && <p className="kg-detail-desc">{selected.description}</p>}
              {selected.conceptTag && <span className="fc-tag">{selected.conceptTag}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
