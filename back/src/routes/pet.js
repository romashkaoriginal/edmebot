const express = require("express");
const seed = require("../data/seed");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

router.get("/", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    res.json({ ...current.profile, shop: seed.shopItems });
  } catch (e) { next(e); }
});

router.post("/buy", async (req, res, next) => {
  try {
    const item = seed.shopItems.find((entry) => entry.id === req.body?.itemId);
    if (!item) return res.status(404).json({ error: "item_not_found" });
    const result = await state.buyItem(req.student, item);
    if (result.error) return res.status(400).json(result);
    res.json({ ok: true, profile: result.state.profile });
  } catch (e) { next(e); }
});

router.post("/rename", async (req, res, next) => {
  try {
    const result = await state.renamePet(req.student, req.body?.name);
    if (result.error) return res.status(400).json(result);
    res.json({ ok: true, profile: result.state.profile });
  } catch (e) { next(e); }
});

module.exports = router;
