export const chatWithCourse = async (courseId, userId, question) => {
  return axios.post(
    `${AI_URL}/chat`,
    { courseId, userId, question },
    {
      responseType: 'stream',
      timeout: 120000,                   // 2 min timeout for slow responses
      headers: { 'Content-Type': 'application/json' }
    }
  )
}