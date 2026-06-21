import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import ErrorBoundary  from '../components/ui/ErrorBoundary'

// Lazy load pages — a crash in one page won't kill the whole app
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

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: '1rem', color: '#94a3b8', fontSize: '0.9rem'
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

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
      <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"              element={<SafePage><Dashboard /></SafePage>} />
        <Route path="/analytics"              element={<SafePage><Analytics /></SafePage>} />
        <Route path="/teacher"                element={<SafePage><TeacherDashboard /></SafePage>} />
        <Route path="/upgrade"                element={<SafePage><Upgrade /></SafePage>} />
        <Route path="/courses/:id"            element={<SafePage><CourseDetail /></SafePage>} />
        <Route path="/courses/:id/flashcards" element={<SafePage><Flashcards /></SafePage>} />
        <Route path="/courses/:id/quiz"       element={<SafePage><Quiz /></SafePage>} />
        <Route path="/courses/:id/graph"      element={<SafePage><KnowledgeGraph /></SafePage>} />
        <Route path="/courses/:id/study-room" element={<SafePage><StudyRoom /></SafePage>} />
        <Route path="/courses/:id/study-buddy" element={<SafePage><StudyBuddy /></SafePage>} />
        <Route path="/courses/:id/study-plan"  element={<SafePage><StudyPlan /></SafePage>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}