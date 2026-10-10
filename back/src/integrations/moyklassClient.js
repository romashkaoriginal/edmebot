const BASE_URL = "https://api.moyklass.com";

class MoyklassError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "MoyklassError";
    this.status = status;
  }
}

class MoyklassClient {
  constructor({ apiKey = process.env.MOYKLASS_API_KEY, fetchImpl = fetch } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.tokenPromise = null;
  }

  get enabled() { return Boolean(this.apiKey); }

  async authenticate() {
    if (!this.enabled) throw new MoyklassError("MOYKLASS_API_KEY is not configured");
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    if (!this.tokenPromise) {
      this.tokenPromise = this.rawRequest("/v1/company/auth/getToken", {
        method: "POST", body: { apiKey: this.apiKey }, authenticated: false,
      }).then((data) => {
        if (!data?.accessToken) throw new MoyklassError("CRM did not return an access token");
        this.token = data.accessToken;
        this.tokenExpiresAt = new Date(data.expiresAt).getTime() || Date.now() + 60_000;
        return this.token;
      }).finally(() => { this.tokenPromise = null; });
    }
    return this.tokenPromise;
  }

  async rawRequest(path, { method = "GET", body, authenticated = true } = {}) {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (authenticated) headers["x-access-token"] = await this.authenticate();
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.fetch(`${BASE_URL}${path}`, {
          method, headers, body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 401 && authenticated && attempt === 0) {
          this.token = null;
          headers["x-access-token"] = await this.authenticate();
          continue;
        }
        if (response.ok) {
          const text = await response.text();
          return text ? JSON.parse(text) : null;
        }
        lastError = new MoyklassError(`CRM request failed: ${response.status}`, response.status);
        if (![429, 500, 502, 503, 504].includes(response.status)) throw lastError;
      } catch (error) {
        lastError = error;
        if (error instanceof MoyklassError && ![429, 500, 502, 503, 504].includes(error.status)) throw error;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
    throw lastError;
  }

  getUser(id) { return this.rawRequest(`/v1/company/users/${encodeURIComponent(id)}`); }
  listUsersByIds(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some((id) => !Number.isSafeInteger(Number(id)))) {
      throw new MoyklassError("CRM userIds must contain 1-100 integer IDs");
    }
    return this.rawRequest(`/v1/company/users?userIds=${ids.join(",")}&limit=100`);
  }
  getAttributes() { return this.rawRequest("/v1/company/userAttributes"); }
  getTags() { return this.rawRequest("/v1/company/userTags"); }
  createTag(name) { return this.rawRequest("/v1/company/userTags", { method: "POST", body: { name } }); }
  setAttribute(id, alias, body) {
    return this.rawRequest(`/v1/company/users/${encodeURIComponent(id)}/attribute/${encodeURIComponent(alias)}`, { method: "POST", body });
  }
  setTags(id, tags) {
    return this.rawRequest(`/v1/company/users/${encodeURIComponent(id)}/tags`, { method: "POST", body: { tags } });
  }
}

module.exports = { MoyklassClient, MoyklassError };
