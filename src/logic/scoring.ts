import type { AxisKey, Job, Question } from '../types'

export const AXES: AxisKey[] = [
  'logic',
  'system',
  'visual',
  'experience',
  'analysis',
  'communication',
]

export function calculateAxisMaximums(questions: Question[]) {
  const result = Object.fromEntries(AXES.map(axis => [axis, 0])) as Record<AxisKey, number>
  for (const question of questions) {
    for (const axis of AXES) {
      result[axis] += Math.max(...question.options.map(option => option.scores?.[axis] ?? 0))
    }
  }
  return result
}

export function calculateJobBonusMaximums(questions: Question[], jobs: Job[]) {
  const result: Record<string, number> = Object.fromEntries(jobs.map(job => [job.id, 0]))
  for (const question of questions) {
    for (const job of jobs) {
      result[job.id] += Math.max(...question.options.map(option => option.jobBonus?.[job.id] ?? 0))
    }
  }
  return result
}

export function calculateUserScores(questions: Question[], answers: Record<number, string>) {
  const axisRaw = Object.fromEntries(AXES.map(axis => [axis, 0])) as Record<AxisKey, number>
  const jobBonusRaw: Record<string, number> = {}

  for (const question of questions) {
    const selectedId = answers[question.id]
    if (!selectedId) continue
    const option = question.options.find(item => item.id === selectedId)
    if (!option) continue

    for (const [axis, score] of Object.entries(option.scores ?? {})) {
      axisRaw[axis as AxisKey] += score ?? 0
    }
    for (const [jobId, bonus] of Object.entries(option.jobBonus ?? {})) {
      jobBonusRaw[jobId] = (jobBonusRaw[jobId] ?? 0) + bonus
    }
  }

  return { axisRaw, jobBonusRaw }
}

export function normalizeAxisScores(axisRaw: Record<AxisKey, number>, axisMaximums: Record<AxisKey, number>) {
  return Object.fromEntries(
    AXES.map(axis => [axis, Math.round((axisRaw[axis] / (axisMaximums[axis] || 1)) * 100)]),
  ) as Record<AxisKey, number>
}

export function normalizeJobBonuses(jobBonusRaw: Record<string, number>, maximums: Record<string, number>) {
  const result: Record<string, number> = {}
  for (const [jobId, max] of Object.entries(maximums)) {
    result[jobId] = max ? Math.round(((jobBonusRaw[jobId] ?? 0) / max) * 100) : 0
  }
  return result
}

export function calculateProfileSimilarity(userAxes: Record<AxisKey, number>, jobAxes: Record<AxisKey, number>) {
  const meanDifference = AXES.reduce((sum, axis) => sum + Math.abs(userAxes[axis] - jobAxes[axis]), 0) / AXES.length
  return Math.max(0, 100 - meanDifference)
}

export function rankJobs(questions: Question[], jobs: Job[], answers: Record<number, string>) {
  const { axisRaw, jobBonusRaw } = calculateUserScores(questions, answers)
  const axisMaximums = calculateAxisMaximums(questions)
  const userAxes = normalizeAxisScores(axisRaw, axisMaximums)
  const bonusMaximums = calculateJobBonusMaximums(questions, jobs)
  const normalizedBonuses = normalizeJobBonuses(jobBonusRaw, bonusMaximums)

  const results = jobs.map(job => {
    const similarity = calculateProfileSimilarity(userAxes, job.axes)
    const directBonus = normalizedBonuses[job.id] ?? 0
    return {
      ...job,
      similarity,
      directBonus,
      finalScore: similarity * 0.85 + directBonus * 0.15,
    }
  }).sort((a, b) => b.finalScore - a.finalScore)

  return { userAxes, results }
}
