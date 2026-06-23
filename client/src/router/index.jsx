import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import ProtectedRoute  from '../components/auth/ProtectedRoute'
import AuthCallback    from '../components/auth/AuthCallback'
import ErrorBoundary   from '../components/ui/ErrorBoundary'
import SignIn          from '../pages/SignIn'
import SignUp          from '../pages/SignUp'
const Landing          = lazy(() => import('../pages/Landing'))

// Lazy-load all page-level components so a crash in one
// never takes down the entire app.
const Dashboard        = lazy(() => import('../pages/Dashboard'))
const CourseDetail     = lazy(() => import('../pages/CourseDetail'))
const Flashcards       = lazy(() => import('../pages/Flashcards'))
const Quiz             = lazy(() => import('../pages/Quiz'))
const KnowledgeGraph   = lazy(() => import('../pages/KnowledgeGraph'))
const StudyRoom        = lazy(() => import('../pages/StudyRoom'))
const Analytics        = lazy(() => import('../pages/Analytics'))
const TeacherDashboard = lazy(() => import('../pages/TeacherDashboard'))
const Upgrade          = lazy(() => import('../pages/Upgrade'))
const StudyBuddy       = lazy(() => import('../pages/StudyBuddy'))
const StudyPlan        = lazy(() => import('../pages/StudyPlan'))
const Profile          = lazy(() => import('../pages/Profile'))

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.85rem',
      minHeight: '55vh',
      color: '#64748b',
      fontSize: '0.875rem',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div className="fc-spinner" />
      Loading…
    </div>
  )
}

function SafePage({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

// Landing already handles auth redirect via useUser internally

export default function AppRouter() {
  return (
    <Routes>
      {/* Root → Landing (it redirects to /dashboard if already signed in) */}
      <Route path="/" element={<SafePage><Landing /></SafePage>} />

      {/* ── Auth pages (no shell / navbar) ────── */}
      <Route path="/sign-in/*" element={<SignIn />} />
      <Route path="/sign-up/*" element={<SignUp />} />
      <Route path="/auth-callback" element={<AuthCallback />} />

      {/* ── Protected pages (wrapped in AppShell) ── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"                element={<SafePage><Dashboard /></SafePage>} />
        <Route path="/analytics"                element={<SafePage><Analytics /></SafePage>} />
        <Route path="/teacher"                  element={<SafePage><TeacherDashboard /></SafePage>} />
        <Route path="/upgrade"                  element={<SafePage><Upgrade /></SafePage>} />
        <Route path="/profile"                  element={<SafePage><Profile /></SafePage>} />
        <Route path="/courses/:id"              element={<SafePage><CourseDetail /></SafePage>} />
        <Route path="/courses/:id/flashcards"   element={<SafePage><Flashcards /></SafePage>} />
        <Route path="/courses/:id/quiz"         element={<SafePage><Quiz /></SafePage>} />
        <Route path="/courses/:id/graph"        element={<SafePage><KnowledgeGraph /></SafePage>} />
        <Route path="/courses/:id/study-room"   element={<SafePage><StudyRoom /></SafePage>} />
        <Route path="/courses/:id/study-buddy"  element={<SafePage><StudyBuddy /></SafePage>} />
        <Route path="/courses/:id/study-plan"   element={<SafePage><StudyPlan /></SafePage>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}