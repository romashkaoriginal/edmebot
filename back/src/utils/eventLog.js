function logEvent(event, req, fields = {}) {
  console.info(JSON.stringify({
    at: new Date().toISOString(),
    event,
    requestId: req?.requestId || null,
    method: req?.method || null,
    path: req?.originalUrl?.split("?")[0] || req?.path || null,
    ...fields,
  }));
}

function denyAccess(req, res, status, reason, fields = {}, responseError = reason) {
  logEvent("access_denied", req, {
    status,
    reason,
    studentId: req.student?.id ?? null,
    ...fields,
  });
  return res.status(status).json({ error: responseError });
}

module.exports = { logEvent, denyAccess };
