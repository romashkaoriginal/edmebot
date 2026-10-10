function trialStartError(student, profile) {
  if (process.env.MOYKLASS_ENFORCE_LINKS === "true") return "trial_managed_in_crm";
  if (student?.moyklass_user_id) return "trial_managed_in_crm";
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
