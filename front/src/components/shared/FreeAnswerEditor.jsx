export default function FreeAnswerEditor({ questionType, acceptedAnswers, onChange, options = [], onOptionsChange }) {
  if (questionType === "match") return <div className="afield"><span>Пары: слева — справа</span><p>Каждая правая часть должна быть уникальной.</p>{acceptedAnswers.map((variants, index) => <div className="aopt" key={index}><input className="ainput" aria-label={`Левая часть пары ${index + 1}`} value={options[index] || ""} onChange={(event) => onOptionsChange(acceptedAnswers.map((_, i) => i === index ? event.target.value : options[i] || ""))} /><span>↔</span><input className="ainput" aria-label={`Правая часть пары ${index + 1}`} value={variants[0]} onChange={(event) => onChange(acceptedAnswers.map((item, i) => i === index ? [event.target.value] : item))} />{acceptedAnswers.length > 2 && <button type="button" aria-label="Удалить пару" onClick={() => { onChange(acceptedAnswers.filter((_, i) => i !== index)); onOptionsChange(options.filter((_, i) => i !== index)); }}>×</button>}</div>)}{acceptedAnswers.length < 8 && <button type="button" className="aselect" onClick={() => { onChange([...acceptedAnswers, [""]]); onOptionsChange([...options.slice(0, acceptedAnswers.length), ""]); }}>Добавить пару</button>}</div>;
  return (
    <div className="afield">
      <span>{questionType === "order" ? "Предложение в правильном порядке" : questionType === "text" ? "Правильный ответ" : "Ответы по порядку пропусков"}</span>
      {questionType === "order" && <p>Слова будут разбиты по пробелам и перемешаны. От 2 до 24 слов; сохраняйте одинаковый набор слов во всех вариантах ответа.</p>}
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
