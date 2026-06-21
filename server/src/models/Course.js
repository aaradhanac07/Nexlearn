import mongoose from 'mongoose'

const courseSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title:           String,
  description:     String,
  summary:         String,
  sourceType:      { type: String, enum: ['pdf', 'youtube', 'text', 'merge'] },
  sourceUrl:       String,                 // primary URL (YouTube link)
  vectorNamespace: String,
  status:          { type: String, enum: ['processing', 'ready', 'error'], default: 'processing' },
  cardCount:       { type: Number, default: 0 },
  concepts:        [String],
  // Smart Content Processor additions
  studyOrder:      [String],              // AI-suggested concept order
  sources: [{                             // all ingested sources for this course
    type:       { type: String, enum: ['pdf', 'youtube', 'text'] },
    name:       String,                   // filename or video title
    url:        String,                   // YouTube URL or undefined
    videoId:    String,                   // YouTube video ID
    chunkCount: { type: Number, default: 0 },
  }],
  crossReference:  String,                // merged summary for multi-source courses
}, { timestamps: true })

export const Course = mongoose.model('Course', courseSchema)