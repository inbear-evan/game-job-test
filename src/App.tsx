import { useMemo, useState } from 'react'
import questionsData from './data/questions.json'
import jobsData from './data/jobs.json'
import type { JobsPayload, QuestionsPayload } from './types'
import { AnswerButton } from './components/AnswerButton'
import { Progress } from './components/Progress'
import { Radar } from './components/Radar'
import { rankJobs } from './logic/scoring'

const questions = (questionsData as QuestionsPayload).questions
const jobs = (jobsData as JobsPayload).jobs

type Screen = 'home' | 'quiz' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const question = questions[index]
  const result = useMemo(() => rankJobs(questions, jobs, answers), [answers])

  const start = () => { setIndex(0); setAnswers({}); setScreen('quiz') }
  const next = () => {
    if (!answers[question.id]) return
    if (index === questions.length - 1) setScreen('result')
    else setIndex(v => v + 1)
  }

  if (screen === 'home') return (
    <main className="app-shell">
      <section className="home-panel">
        <div className="eyebrow">GAME CAREER QUEST</div>
        <h1>나는 게임회사에서<br/><em>어떤 일을 잘할까?</em></h1>
        <p>30개의 선택으로 나에게 가까운 게임 개발 직무를 찾아보세요.</p>
        <button className="primary" onClick={start}>테스트 시작하기</button>
      </section>
    </main>
  )

  if (screen === 'result') return (
    <main className="app-shell result-shell">
      <section className="result-panel">
        <div className="eyebrow">YOUR GAME CAREER</div>
        <h1>당신에게 가까운 직무는<br/><em>{result.results[0]?.name}</em></h1>
        <Radar scores={result.userAxes} />
        <div className="result-list">
          {result.results.slice(0,5).map((job, i) => (
            <article className="result-item" key={job.id}>
              <span className="rank">{i + 1}</span>
              <div><strong>{job.name}</strong><p>{job.description}</p></div>
              <b>{Math.round(job.finalScore)}%</b>
            </article>
          ))}
        </div>
        <button className="primary" onClick={start}>다시 테스트하기</button>
      </section>
    </main>
  )

  return (
    <main className="app-shell">
      <section className="quiz-panel">
        <header className="quiz-header">
          <div><strong>게임 직무 탐험 테스트</strong><small>나에게 딱 맞는 게임 커리어를 찾아요.</small></div>
          <Progress current={index + 1} total={questions.length} />
        </header>
        <div className="question-index">Q{index + 1}.</div>
        <h1 className="question">{question.question}</h1>
        <p className="helper">가장 나다운 선택 하나를 골라주세요.</p>
        <div className="answers">
          {question.options.map(option => (
            <AnswerButton
              key={option.id}
              text={option.text}
              selected={answers[question.id] === option.id}
              onClick={() => setAnswers(a => ({ ...a, [question.id]: option.id }))}
            />
          ))}
        </div>
        <div className="quiz-actions">
          <button className="back" disabled={index === 0} onClick={() => setIndex(v => Math.max(0, v - 1))}>← 이전 단계로</button>
          <button className="primary" disabled={!answers[question.id]} onClick={next}>{index === questions.length - 1 ? '결과 보기' : '다음 단계로'}</button>
        </div>
      </section>
    </main>
  )
}
