const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const { MoyklassClient } = require("../src/integrations/moyklassClient");
const { FIELD_ALIASES, alias, TAG_NAMES, validateAttributes } = require("../src/integrations/moyklassAccess");

(async () => {
  const client = new MoyklassClient();
  if (!client.enabled) throw new Error("MOYKLASS_API_KEY is missing");
  const [attributes, tags] = await Promise.all([client.getAttributes(), client.getTags()]);
  const byAlias = new Map(attributes.map((item) => [item.alias, item]));
  const { errors } = validateAttributes(attributes);
  for (const key of Object.keys(FIELD_ALIASES)) {
    const field = byAlias.get(alias(key));
    console.log(`${key}: ${field ? `${field.name} | ${field.alias} | ${field.type} | id=${field.id}` : `MISSING (${alias(key)})`}`);
    if (key === "subjects" && field) {
      for (const option of field.variants || []) console.log(`  ${option.id}: ${option.name}`);
    }
    if (key === "kind" && field) {
      for (const option of field.variants || []) console.log(`  ${option.id}: ${option.name}`);
    }
  }
  const tagNames = new Set(tags.map((tag) => tag.name));
  for (const name of Object.values(TAG_NAMES)) console.log(`tag ${name}: ${tagNames.has(name) ? "present" : "missing"}`);
  for (const error of errors) console.error(`CRM field error: ${error}`);
  if (errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
