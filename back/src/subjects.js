// One canonical value per subject keeps task-bank filters, student enrollments
// and spreadsheet imports compatible with each other.
const SUBJECT_VARIANTS = [
  { canonical: "Математика", aliases: ["математика"] },
  { canonical: "Русский", aliases: ["русский", "русский язык"] },
];

const SUBJECT_BY_ALIAS = new Map(
  SUBJECT_VARIANTS.flatMap(({ canonical, aliases }) =>
    aliases.map((alias) => [alias, canonical])
  )
);

function normalizeSubject(value) {
  const subject = String(value ?? "").trim().replace(/\s+/g, " ");
  return SUBJECT_BY_ALIAS.get(subject.toLocaleLowerCase("ru-RU")) ?? subject;
}

module.exports = { SUBJECT_VARIANTS, normalizeSubject };
