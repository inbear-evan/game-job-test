interface Props {
  text: string
  selected: boolean
  onClick: () => void
}

export function AnswerButton({ text, selected, onClick }: Props) {
  return (
    <button className={`answer ${selected ? 'answer--selected' : ''}`} onClick={onClick}>
      {text}
    </button>
  )
}
