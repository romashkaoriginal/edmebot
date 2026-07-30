function trialStartError(student, profile) {
  if (!profile?.diagnostic_done || !profile?.pet_selected) {
    return "trial_prerequisites_incomplete";
  }
  if (student?.trial_used) return "trial_already_used";
  if (student?.status !== "pending" || student?.access_kind !== null) {
    return "trial_not_available";
  }
  return null;
}

module.exports = { trialStartError };
