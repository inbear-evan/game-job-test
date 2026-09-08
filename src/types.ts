export type AxisKey =
  | 'logic'
  | 'system'
  | 'visual'
  | 'experience'
  | 'analysis'
  | 'communication'

export type Scores = Partial<Record<AxisKey, number>>

export interface QuizOption {
  id: string
  text: string
  scores: Scores
  jobBonus: Record<string, number>
}

export interface Question {
  id: number
  question: string
  options: QuizOption[]
}

export interface QuestionsPayload {
  version: string
  title: string
  axes: AxisKey[]
  questionCount: number
  questions: Question[]
}

export interface Job {
  id: string
  group: string
  name: string
  axes: Record<AxisKey, number>
  description: string
}

export interface JobsPayload {
  version: string
  axes: AxisKey[]
  jobCount: number
  jobs: Job[]
}
