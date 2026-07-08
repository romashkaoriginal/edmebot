const express = require("express");
const store = require("../store");
const seed = require("../data/seed");

const router = express.Router();

// Pet state + shop (module 6)
router.get("/", (req, res) => {
  const p = store.state.profile;
  res.json({
    pet: p.pet,
    coins: p.coins,
    streak: p.streak,
    streakFreezeUsed: p.streakFreezeUsed,
    ownedItems: p.ownedItems,
    shop: seed.shopItems,
  });
});

// Buy a shop item
router.post("/buy", (req, res) => {
  const { itemId } = req.body ?? {};
  if (!itemId) return res.status(400).json({ error: "itemId_required" });
  const result = store.buyItem(itemId);
  if (result.error) {
    const code = result.error === "item_not_found" ? 404 : 400;
    return res.status(code).json(result);
  }
  res.json(result);
});

module.exports = router;
