/**
 * Socket.io client singleton for NexLearn study rooms.
 */
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let studySocket = null

export function getStudySocket() {
  if (!studySocket) {
    studySocket = io(`${API_URL}/study`, {
      autoConnect: false,
      transports: ['websocket']
    })
  }
  return studySocket
}

export function connectStudyRoom(courseId, userId, userName) {
  const socket = getStudySocket()
  if (!socket.connected) socket.connect()
  socket.emit('join-room', { courseId, userId, userName })
  return socket
}

export function disconnectStudyRoom(courseId) {
  const socket = getStudySocket()
  if (socket.connected) {
    socket.emit('leave-room', { courseId })
  }
}
