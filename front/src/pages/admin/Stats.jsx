import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import ProgressBar from "../../components/ui/ProgressBar";
import { adminApi } from "../../api/admin";
import "./admin.css";

export default function Stats() {
  const [summary, setSummary] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .stats()
      .then(({ students }) => {
        setSummary(students);
        if (students[0]) setSelectedId(String(students[0].id));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    adminApi
      .studentStats(selectedId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId]);

  return (
    <div className="apage">
      <header className="apage__head">
        <span className="apage__head-icon">
          <BarChart3 size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h1>Статистика</h1>
          <p className="apage__sub">Сводка по всем ученикам и детали по каждому</p>
        </div>
      </header>

      {error && <p className="aerror">{error}</p>}

      <SectionTitle>Все ученики</SectionTitle>
      {summary.length === 0 ? (
        <p className="aempty">Нет данных — добавьте учеников.</p>
      ) : (
        <div className="alist">
          {summary.map((s) => (
            <div className="arow" key={s.id}>
              <div className="arow__main">
                <div className="arow__title">{s.name}</div>
                <div className="arow__meta">
                  {s.grade} класс · {s.subject} · решено {s.attempts} · точность {s.accuracy}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="asection" pad="md">
        <SectionTitle>Детально по ученику</SectionTitle>
        <label className="afield">
          <span>Ученик</span>
          <select className="aselect" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {summary.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {detail && (
          <div className="asection">
            <div className="astat-grid">
              <div className="astat">
                <div className="astat__num">{detail.stats.attempts}</div>
                <div className="astat__label">Решено заданий</div>
              </div>
              <div className="astat">
                <div className="astat__num">{detail.stats.correct}</div>
                <div className="astat__label">Верных ответов</div>
              </div>
              <div className="astat">
                <div className="astat__num">{detail.stats.accuracy}%</div>
                <div className="astat__label">Точность</div>
              </div>
            </div>

            <SectionTitle>По темам</SectionTitle>
            {detail.byTopic.length === 0 ? (
              <p className="aempty">Ученик ещё не решал задания.</p>
            ) : (
              <div className="alist">
                {detail.byTopic.map((t) => (
                  <div className="arow" key={t.topic} style={{ display: "block" }}>
                    <div className="arow__meta" style={{ marginBottom: 6 }}>
                      <b style={{ color: "var(--ink)" }}>{t.topic}</b> — {t.correct}/{t.attempts} верно ({t.mastery}%)
                    </div>
                    <ProgressBar
                      value={t.mastery}
                      max={100}
                      tone={t.mastery >= 75 ? "success" : t.mastery >= 50 ? "warning" : "danger"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
