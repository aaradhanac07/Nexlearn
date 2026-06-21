import mongoose from 'mongoose'

const nodeSchema = new mongoose.Schema({
  id:          String,
  label:       String,
  conceptTag:  String,
  description: String,
  masteryPct:  { type: Number, default: 0 }  // filled in at query time
}, { _id: false })

const edgeSchema = new mongoose.Schema({
  source:   String,
  target:   String,
  relation: String
}, { _id: false })

const knowledgeGraphSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true, unique: true },
  nodes:    [nodeSchema],
  edges:    [edgeSchema],
}, { timestamps: true })

export const KnowledgeGraph = mongoose.model('KnowledgeGraph', knowledgeGraphSchema)
