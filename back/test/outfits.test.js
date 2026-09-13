const test = require("node:test");
const assert = require("node:assert/strict");
const { outfits, shopItems } = require("../src/data/seed");

test("every outfit is a complete four-slot look with unique items", () => {
  assert.ok(outfits.length >= 5);

  const seenItemIds = new Set();
  for (const outfit of outfits) {
    assert.equal(outfit.itemIds.length, 4, `${outfit.name} must contain four items`);
    const items = outfit.itemIds.map((id) => shopItems.find((item) => item.id === id));
    assert.ok(items.every(Boolean), `${outfit.name} references a missing shop item`);
    assert.ok(items.every((item) => item.category === "look" && item.accessory && item.slot));
    assert.equal(new Set(items.map((item) => item.slot)).size, items.length, `${outfit.name} has conflicting slots`);
    assert.ok(items.every((item) => item.outfit === outfit.id));
    items.forEach((item) => {
      assert.equal(seenItemIds.has(item.id), false, `${item.id} belongs to more than one outfit`);
      seenItemIds.add(item.id);
    });
  }
});
