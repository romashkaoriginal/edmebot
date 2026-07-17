---
target: дизайн раздела питомцев
total_score: 22
p0_count: 0
p1_count: 4
timestamp: 2026-07-13T12-06-52Z
slug: front-src-pages-pet-jsx
---
# Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2/4 | Loading and toasts exist, but pet care has no persistent visible effect. |
| 2 | Match system / real world | 3/4 | Care metaphor is clear; coins, points and study points are mixed. |
| 3 | User control and freedom | 2/4 | Name editing has cancel, but purchases have no undo and onboarding cannot be deferred. |
| 4 | Consistency and standards | 2/4 | Shared buttons coexist with local controls and native confirm dialogs. |
| 5 | Error prevention | 1/4 | Feed can silently purchase food; first choice does not disclose the later change price. |
| 6 | Recognition rather than recall | 3/4 | Actions and species are labelled and visually distinct. |
| 7 | Flexibility and efficiency | 2/4 | Shop tabs support arrows; the first-choice radiogroup does not. |
| 8 | Aesthetic and minimalist design | 2/4 | Strong mascot focus, but room, streak, species switch and shop compete. |
| 9 | Error recovery | 3/4 | Errors preserve state and explain failures; no undo or inline retry. |
| 10 | Help and documentation | 2/4 | Coin popover exists, but care effects and choice consequences are unclear. |
| **Total** | | **22/40** | **Acceptable; substantial revision needed** |

# Anti-Patterns Verdict

The pet system is not a generic SaaS template. Unique silhouettes, per-species accessory anchors and matching shop previews are real product craft. The AI-like signals are the hardcoded decorative CSS room, five equally structured mascot cards, constant motion on every avatar and a long sequence of rounded cards. The screen feels like a generic gamified learning app rather than a distinctive EDme companion system.

The deterministic detector returned 0 findings for `Pet.jsx` and `PetAvatar.jsx`. Manual review found issues outside its rule set: success text contrast below 4.5:1, missing focus differentiation on the inline name input, possible overlap of name and coin chips, incomplete radiogroup keyboard behavior and excessive permanent animation.

# Overall Impression

The animals themselves are the strongest visual asset in the student app. They are readable, friendly and technically more sophisticated than simple palette swaps. The main weakness is that they behave like animated skins inside a store: every pet is always happy, feeding and petting have no persistent meaning, and the interface gives the shop more weight than the learning relationship.

# What's Working

- Five species have genuinely different silhouettes and anatomy.
- Accessories attach through per-species anchors and previews match the worn result.
- Reduced motion, labelled controls, Enter/Escape name editing and clear purchase errors provide a solid accessibility base.

# Priority Issues

## [P1] Pet care has no visible state

The hero always renders `mood="happy"`; feeding and petting only trigger temporary animation. Add a small, non-punitive companion state tied to learning: mood/energy should improve from study and unlock reactions, not decay into guilt. Show the effect beside each action.

## [P1] Feeding can silently spend coins

The hero action calls purchase when the default food is not owned, despite showing no item or price. Separate Buy and Use, or show the food and price before confirmation. Never spend child-facing currency from a care action without explicit price disclosure.

## [P1] First choice hides the cost of changing later

Before the primary CTA, show the selected species, generated name and `Сменить позже — 100 монет`. The current default fox/name makes an irreversible-looking choice too easy to confirm accidentally.

## [P1] Mobile and accessibility states need hardening

Long names can collide with the coin chip; success text contrast is about 3.8–4.0:1; inline name focus is not visually distinct. Add width constraints/ellipsis or stack chips on narrow widths, use a darker success tone and restore a clear focus-visible state. Implement roving tabindex and arrow keys for first-choice radios.

## [P2] Too much simultaneous motion and juvenile tone

The main pet and five cards can run at least twelve infinite animations. Keep list thumbnails static. Reserve unique, short reactions for the selected pet: fox tail movement, owl head turn, cat ear twitch, squirrel tail flick, raccoon blink. Replace guilt copy about a bored pet with positive rewards.

## [P2] The room and shop do not form one system

Home and collectible purchases do not visibly change the room. Either render bought room items in the scene or remove those categories until supported. Add preview-on-pet before buying clothing. Rebalance the page so the companion is primary and the store is secondary.

# Persona Red Flags

## Student, grades 6–8

Five moving characters distract from comparison. The default fox and name encourage confirming without understanding the choice. The purpose of feeding and petting is unclear, and hidden currency spending will feel unfair.

## Student, grades 9–11

Blush, constant bouncing, `Ням!` and guilt about a bored pet can feel too young. A universal design should keep the mascot but present it as a polished game companion: calmer idle state, sharper copy, less decorative scenery and stronger connection to study progress.

## Keyboard / low-vision user

The custom radiogroup lacks expected arrow navigation, the name input has weak focus differentiation, and success text misses AA contrast. Long names risk overlap at narrow widths.

# Minor Observations

- Use one term for currency: `монеты` is clearest for the pet economy.
- Replace native `window.confirm` with an in-product confirmation sheet showing current pet, new pet and price.
- Close the coin popover on Escape/outside click.
- The CSS scene is called a room but visually reads as an outdoor lawn.
- After adoption, add one short peak moment: selected pet appears large, says hello using its name, then opens the full app.

# Questions to Consider

- If feeding changes nothing, why should the student return tomorrow?
- Would a 16-year-old comfortably open this screen around classmates?
- Is the pet a learning companion or a storefront mascot?
- Why is the future change price hidden during the first selection?
