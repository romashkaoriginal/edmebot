export default function FreeAnswerEditor({ questionType, acceptedAnswers, onChange }) {
  return (
    <div className="afield">
      <span>{questionType === "text" ? "Правильный ответ" : "Ответы по порядку пропусков"}</span>
      <p>Допустимые варианты одного ответа разделяйте знаком |. Регистр и лишние пробелы при проверке не учитываются.</p>
      {acceptedAnswers.map((variants, index) => (
        <div className="aopt" key={index}>
          {questionType === "blanks" && <span>{index + 1}.</span>}
          <input className="ainput" value={variants.join("|")} onChange={(event) => onChange(acceptedAnswers.map((item, i) => i === index ? event.target.value.split("|") : item))} placeholder="Ответ | допустимый вариант" />
          {questionType === "blanks" && acceptedAnswers.length > 1 && <button type="button" className="aopt__del" onClick={() => onChange(acceptedAnswers.filter((_, i) => i !== index))} aria-label="Убрать пропуск">×</button>}
        </div>
      ))}
      {questionType === "blanks" && acceptedAnswers.length < 12 && <button type="button" className="aselect" onClick={() => onChange([...acceptedAnswers, [""]])}>Добавить пропуск</button>}
    </div>
  );
}
