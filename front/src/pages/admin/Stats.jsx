import { useEffect, useState, useMemo } from "react";
import { BarChart3, Search, Target, CheckCircle2, Percent, ChevronRight } from "lucide-react";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import ProgressBar from "../../components/ui/ProgressBar";
import { adminApi } from "../../api/admin";
import "./admin.css";

const GRADES = [5, 6, 7, 8, 9, 10, 11];

export default function Stats() {
  const [summary, setSummary] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    adminApi
      .stats()
      .then(({ students }) => {
        setSummary(students);
        if (students[0]) setSelectedId(String(students[0].id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    adminApi
      .studentStats(selectedId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId]);

  const subjects = useMemo(
    () => [...new Set(summary.map((s) => s.subject).filter(Boolean))],
    [summary]
  );

  const filtered = summary.filter((s) => {
    if (gradeFilter !== "all" && String(s.grade) !== gradeFilter) return false;
    if (subjectFilter !== "all" && s.subject !== subjectFilter) return false;
    return `${s.name} ${s.subject ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  });

  const selected = summary.find((s) => String(s.id) === String(selectedId));

  return (
    <div className="apage">
      <header className="apage__head">
        <span className="apage__head-icon apage__head-icon--stats">
          <BarChart3 size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Статистика</h1>
        </div>
      </header>

      {error && <p className="aerror">{error}</p>}

      <div className="afilters">
        <label className="asearch">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск ученика" />
        </label>
        <select className="aselect afilter" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Предмет">
          <option value="all">Все предметы</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="aselect afilter" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} aria-label="Класс">
          <option value="all">Все классы</option>
          {GRADES.map((g) => <option key={g} value={g}>{g} класс</option>)}
        </select>
      </div>

      <div className="astats-layout">
        {/* Left: pick a student */}
        <div className="asection">
          <SectionTitle>Ученики ({filtered.length})</SectionTitle>
          {loading ? (
            <p className="aempty">Загрузка…</p>
          ) : summary.length === 0 ? (
            <p className="aempty">Пока нет учеников со статистикой.</p>
          ) : filtered.length === 0 ? (
            <p className="aempty">По этому запросу учеников нет.</p>
          ) : (
            <div className="alist">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  className={`arow arow--card arow--pick${String(s.id) === String(selectedId) ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(String(s.id))}
                >
                  <span className="aavatar" aria-hidden="true">{initials(s.name)}</span>
                  <div className="arow__main">
                    <div className="arow__title">{s.name}</div>
                    <div className="arow__meta">
                      {s.grade} класс · {s.subject}
                    </div>
                  </div>
                  <div className="apick-stat">
                    <span className="apick-stat__num">{s.accuracy}%</span>
                    <span className="apick-stat__cap">{s.attempts} решено</span>
                  </div>
                  <ChevronRight size={18} strokeWidth={2.6} className="atopic__go" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: selected student's detail */}
        <Card className="astats-detail" pad="md">
          {!selected ? (
            <p className="aempty">Выберите ученика слева, чтобы увидеть детали.</p>
          ) : (
            <>
              <div className="astats-detail__head">
                <span className="aavatar aavatar--lg" aria-hidden="true">{initials(selected.name)}</span>
                <div>
                  <h2 className="astats-detail__name">{selected.name}</h2>
                  <p className="arow__meta">{selected.grade} класс · {selected.subject}</p>
                </div>
              </div>

              {detail && (
                <>
                  <div className="astat-grid">
                    <div className="astat astat--a">
                      <Target className="astat__ic" size={18} strokeWidth={2.4} />
                      <div className="astat__num">{detail.stats.attempts}</div>
                      <div className="astat__label">Решено заданий</div>
                    </div>
                    <div className="astat astat--b">
                      <CheckCircle2 className="astat__ic" size={18} strokeWidth={2.4} />
                      <div className="astat__num">{detail.stats.correct}</div>
                      <div className="astat__label">Верных ответов</div>
                    </div>
                    <div className="astat astat--c">
                      <Percent className="astat__ic" size={18} strokeWidth={2.4} />
                      <div className="astat__num">{detail.stats.accuracy}%</div>
                      <div className="astat__label">Точность</div>
                    </div>
                  </div>

                  <SectionTitle>По темам</SectionTitle>
                  {detail.byTopic.length === 0 ? (
                    <p className="aempty">Ученик ещё не решал задания.</p>
                  ) : (
                    <div className="atopic-stats">
                      {detail.byTopic.map((t) => (
                        <div className="atopic-stat" key={t.topic}>
                          <div className="atopic-stat__row">
                            <b>{t.topic}</b>
                            <span className="arow__meta">{t.correct}/{t.attempts} · {t.mastery}%</span>
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
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
