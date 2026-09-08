import { useMemo, useState } from 'react'
import questionsData from './data/questions.json'
import jobsData from './data/jobs.json'
import affiliateProductsData from './data/affiliate-products.json'
import type { JobsPayload, QuestionsPayload } from './types'
import { AnswerButton } from './components/AnswerButton'
import { Progress } from './components/Progress'
import { Radar } from './components/Radar'
import { rankJobs } from './logic/scoring'

const questions = (questionsData as QuestionsPayload).questions
const jobs = (jobsData as JobsPayload).jobs

type AffiliateProduct = {
  frame: string
  url: string
}

const affiliateProducts = affiliateProductsData as Record<string, AffiliateProduct[]>
const sampleAffiliateProduct: AffiliateProduct = {
  frame: 'https://coupa.ng/cpj316',
  url: 'https://coupa.ng/cpj316',
}

const formattedQuestions: Record<number, string> = {
  1: '특정 상황에서 캐릭터가 멈추는 버그를 발견했다면,\n가장 먼저 무엇을 확인하고 싶나요?',
  2: '새로운 게임을 시작했을 때,\n가장 먼저 눈에 들어오는 것은?',
  3: '새로운 캐릭터 스킬을 만든다면,\n가장 재미있을 것 같은 과정은?',
  4: '게임 화면이 어딘가 밋밋하게 느껴진다면,\n가장 먼저 무엇을 손대고 싶나요?',
  5: '팀 프로젝트를 시작한다면,\n자연스럽게 맡고 싶은 역할은?',
  6: '전투가 재미없다는 피드백을 받았다면,\n가장 먼저 무엇을 확인하나요?',
  7: '게임에 새로운 지역을 만든다면,\n가장 먼저 무엇을 정하고 싶나요?',
  8: '게임 재화가 예상보다 너무 빠르게 쌓인다면,\n가장 먼저 무엇을 확인하나요?',
  9: '같은 반복 작업을 계속 해야 한다면,\n어떤 방식으로 해결하고 싶나요?',
  10: '처음 보는 게임 엔진 기능을 접했을 때,\n가장 먼저 드는 생각은?',
  11: '친구가 만든 게임에 피드백을 준다면,\n가장 먼저 무엇을 살펴보나요?',
  12: '게임 속 보스전을 만든다면,\n가장 끌리는 작업은?',
  13: '게임에 새로운 기능을 추가하기 전에,\n가장 먼저 무엇을 확인하고 싶나요?',
  14: '캐릭터 하나를 맡게 된다면,\n가장 관심이 가는 부분은?',
  15: '게임 UI가 어렵다는 평가가 많다면,\n가장 먼저 무엇을 바꾸고 싶나요?',
  16: '갑자기 게임 프레임이 크게 떨어졌다면,\n가장 먼저 무엇을 확인하나요?',
  17: '음악과 효과음이 모두 빠진 게임을 플레이한다면,\n가장 먼저 무엇이 신경 쓰이나요?',
  18: '스토리가 중요한 게임을 만든다면,\n가장 재미있을 것 같은 작업은?',
  19: '업데이트 후 유저 반응이 좋지 않다면,\n가장 먼저 무엇을 확인하나요?',
  20: '기획이 아직 명확하지 않은 프로젝트라면,\n어떻게 시작하고 싶나요?',
  21: '팀원 두 명의 의견이 완전히 다르다면,\n어떻게 결정하고 싶나요?',
  22: '새로운 기술을 공부할 때,\n가장 편한 방법은?',
  23: '포트폴리오 하나를 만든다면,\n어떤 결과물이 가장 만족스러울까요?',
  24: '프로젝트가 성공했을 때,\n가장 뿌듯할 것 같은 순간은?',
  25: '멀티플레이에서 다른 플레이어 위치가 어긋난다면,\n가장 먼저 무엇을 확인하나요?',
  26: '새 빌드마다 같은 기능을 반복 테스트해야 한다면,\n어떻게 해결하고 싶나요?',
  27: '게임을 스토어에 처음 공개한다면,\n가장 해보고 싶은 일은?',
  28: '수백 개의 캐릭터 음성 파일을 받았다면,\n가장 먼저 해보고 싶은 작업은?',
  29: '한국에서 만든 게임을 여러 국가에 출시한다면,\n가장 관심이 가는 일은?',
  30: '업데이트 직후 불만이 쏟아진다면,\n가장 먼저 어떻게 대응하고 싶나요?',
}

type Screen = 'home' | 'quiz' | 'result'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const question = questions[index]
  const result = useMemo(() => rankJobs(questions, jobs, answers), [answers])
  const displayQuestion = formattedQuestions[question.id] ?? question.question
  const questionClass = displayQuestion.length > 48 ? 'question question--long' : 'question'
  const topJob = result.results[0]
  const configuredProducts = topJob ? (affiliateProducts[topJob.id] ?? []) : []
  const recommendedProducts = configuredProducts.length > 0 ? configuredProducts : [sampleAffiliateProduct]

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
        <h1>당신에게 가까운 직무는<br/><em>{topJob?.name}</em></h1>
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

        <section className="product-recommendations">
          <div className="product-recommendations__heading">
            <div>
              <span className="product-recommendations__eyebrow">RECOMMENDED</span>
              <h2>{topJob?.name} 준비에 도움이 되는 추천 상품</h2>
            </div>
            <span className="product-recommendations__count">{recommendedProducts.length}개</span>
          </div>

          <div className="product-row" aria-label={`${topJob?.name} 추천 상품`}>
            {recommendedProducts.map((product, productIndex) => (
              <div className="product-frame" key={`${product.frame}-${productIndex}`}>
                <iframe
                  src={product.frame}
                  width="120"
                  height="240"
                  frameBorder="0"
                  scrolling="no"
                  referrerPolicy="unsafe-url"
                  tabIndex={-1}
                  aria-hidden="true"
                  title={`${topJob?.name} 추천 상품 ${productIndex + 1}`}
                />
                <a
                  className="product-frame__click-target"
                  href={product.url || product.frame}
                  target="_blank"
                  rel="sponsored nofollow noopener noreferrer"
                  aria-label={`${topJob?.name} 추천 상품 ${productIndex + 1} 쿠팡에서 보기`}
                >
                  <span className="sr-only">쿠팡에서 상품 보기</span>
                </a>
              </div>
            ))}
          </div>
        </section>

        <button className="primary result-restart" onClick={start}>다시 테스트하기</button>
        <p className="affiliate-disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
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
        <h1 className={questionClass}>{displayQuestion}</h1>
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
