const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SSL_QUERY_PARAMS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "uselibpqcompat",
];

function buildDatabaseConfig(connectionString, env = process.env) {
  if (!connectionString) {
    return { connectionString, ssl: false, sslVerified: false };
  }

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection string");
  }

  const isLocal = LOCAL_DATABASE_HOSTS.has(parsed.hostname);
  const isSupabasePooler = parsed.hostname.endsWith(".pooler.supabase.com");
  const urlSslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  const configuredMode = env.DATABASE_SSL_MODE?.trim().toLowerCase();

  for (const param of SSL_QUERY_PARAMS) parsed.searchParams.delete(param);

  if (isLocal) {
    return { connectionString: parsed.toString(), ssl: false, sslVerified: false };
  }

  const ca = env.DATABASE_SSL_CA?.replace(/\\n/g, "\n").trim();
  const mode = ca
    ? "verify-full"
    : configuredMode || urlSslMode || (isSupabasePooler ? "require" : "verify-full");

  if (!["require", "verify-full"].includes(mode)) {
    throw new Error("DATABASE_SSL_MODE must be either require or verify-full");
  }

  const sslVerified = mode === "verify-full";
  return {
    connectionString: parsed.toString(),
    ssl: {
      rejectUnauthorized: sslVerified,
      ...(ca ? { ca } : {}),
    },
    sslVerified,
  };
}

module.exports = { buildDatabaseConfig };
