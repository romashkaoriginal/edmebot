export function enrolledSubjects(profile) {
  const subjects = profile.subjects?.filter((item) => item?.subject) ?? [];
  return subjects.length ? subjects : profile.subject ? [{ subject: profile.subject, grade: profile.grade }] : [];
}

export function subjectLabel(subject) {
  return subject === "Русский" ? "Русский язык" : subject;
}
