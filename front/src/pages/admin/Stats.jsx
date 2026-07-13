import { useEffect, useState, useMemo } from "react";
import {
  BarChart3, Search, Target, CheckCircle2, Percent, ChevronRight,
  Flame, Trophy, Coins, BookOpen, PawPrint,
} from "lucide-react";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import ProgressBar from "../../components/ui/ProgressBar";
import { adminApi } from "../../api/admin";
import "./admin.css";

const GRADES = [6, 7, 8, 9, 10, 11];
const PET_NAMES = { fox: "Лиса", cat: "Кот", owl: "Сова", dragon: "Дракон" };

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
      <header className="apage__head apage__head--compact">
        <span className="apage__head-icon apage__head-icon--stats">
          <BarChart3 size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Статистика</h1>
          <p className="apage__sub">Прогресс, активность и слабые темы учеников</p>
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
                <div className="aaccuracy" style={{ "--accuracy": `${selected.accuracy}%` }} aria-label={`Точность ${selected.accuracy}%`}>
                  <span>{selected.accuracy}%</span>
                  <small>точность</small>
                </div>
              </div>

              {detail && (
                <>
                  {/* Gamification snapshot — level, streak, coins, pet. */}
                  {detail.profile && (
                    <div className="agame-row">
                      <div className="agame">
                        <Trophy size={16} strokeWidth={2.4} className="agame__ic agame__ic--level" />
                        <span className="agame__num">{detail.profile.level}</span>
                        <span className="agame__cap">уровень</span>
                      </div>
                      <div className="agame">
                        <Flame size={16} strokeWidth={2.4} className="agame__ic agame__ic--streak" />
                        <span className="agame__num">{detail.profile.streak}</span>
                        <span className="agame__cap">стрик</span>
                      </div>
                      <div className="agame">
                        <Coins size={16} strokeWidth={2.4} className="agame__ic agame__ic--coins" />
                        <span className="agame__num">{detail.bonusBalance ?? detail.profile.coins}</span>
                        <span className="agame__cap">баллы</span>
                      </div>
                      <div className="agame">
                        <PawPrint size={16} strokeWidth={2.4} className="agame__ic agame__ic--pet" />
                        <span className="agame__num agame__num--sm">{detail.profile.pet_name}</span>
                        <span className="agame__cap">{PET_NAMES[detail.profile.pet_species] || "питомец"}</span>
                      </div>
                    </div>
                  )}

                  {detail.profile && (
                    <div className="axp">
                      <div className="axp__row">
                        <span>Опыт до след. уровня</span>
                        <span className="arow__meta">{detail.profile.xp_from_level} / {detail.profile.xp_for_next} XP</span>
                      </div>
                      <ProgressBar
                        value={detail.profile.xp_from_level}
                        max={detail.profile.xp_for_next || 1}
                        tone="accent"
                      />
                    </div>
                  )}

                  <SectionTitle>Практика</SectionTitle>
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

                  {detail.homework && (
                    <>
                      <SectionTitle>Домашка</SectionTitle>
                      <div className="ahw-row">
                        <div className="ahw-chip">
                          <BookOpen size={15} strokeWidth={2.4} />
                          <b>{detail.homework.total}</b> всего
                        </div>
                        <div className="ahw-chip ahw-chip--done">
                          <CheckCircle2 size={15} strokeWidth={2.4} />
                          <b>{detail.homework.done}</b> сдано
                        </div>
                        <div className="ahw-chip ahw-chip--active">
                          <b>{detail.homework.active}</b> активно
                        </div>
                        {detail.homework.overdue > 0 && (
                          <div className="ahw-chip ahw-chip--overdue">
                            <b>{detail.homework.overdue}</b> просрочено
                          </div>
                        )}
                      </div>
                    </>
                  )}

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
