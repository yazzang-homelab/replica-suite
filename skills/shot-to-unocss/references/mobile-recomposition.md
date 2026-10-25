# Mobile recomposition (desktop design -> phone)

PC fidelity is not mechanical stacking. Keep intent, hierarchy, critical content, CTA priority and trust signals; recompose for scroll rhythm and touch.

Modes: `responsive-basic` (admin, minor pages: no overflow, usable controls) · `mobile-recomposition` (default for marketing/B2B/product pages) · `mobile-strict` (core landing/home; needs a mobile section contract) · `mobile-repair` (fix the 1-3 largest mobile faults of an existing page).

Passes: 1) desktop fidelity first; 2) per-section classification (type, item count, density, visual priority, primary action, scroll cost, touch needs, compression options); 3) acceptance (intent kept, critical content kept, non-mechanical layout, readable type, touch usability, no horizontal overflow).

## Typography and density floors (375/390 CSS px)
- Body, card description, form labels: 13-14px minimum; secondary labels/chips 12-13px; card titles 15-17px+; page hero titles 20-24px+; controls >= 13-14px text with ~44px target.
- Decision-critical text (titles, CTA, form labels/errors, price, specs, quantity, status, nav, filters) is a hard gate: never below ~12px.
- If a layout only fits with tiny text it is over-dense: reduce columns, shorten labels, group secondary specs, accordion, move less important info lower, horizontal scroll. Rebalance the component (line-height, padding, columns), do not just scale fonts.
- Unit-conversion note for 750-design-width (rpx) projects: 2rpx = 1px at 375; write both units in notes.

## Section strategies
- Hero/CTA: keep headline, primary CTA, core trust signal; stack/crop/simplify visuals; CTA visible early.
- Product/service/case cards: keep names and decision details; line-clamp descriptions; compact single column, horizontal scroller, or featured + carousel.
- Feature/stat/logo/trust grids: 2-column compact grid or small horizontal scroller, not a default one-column list.
- Forms: one column, labels above, full-width submit, 44px inputs, errors inline.
- Tables: card rows or horizontal scroll with sticky first column.
- Navigation: collapse to menu/drawer or bottom bar; keep the primary action reachable.

## Evidence
Real emulated viewport screenshots (390x844, DPR 2) with printed `innerWidth`/`scrollWidth`, per-section crops, list of typography-floor violations and accepted exceptions, no horizontal overflow.
