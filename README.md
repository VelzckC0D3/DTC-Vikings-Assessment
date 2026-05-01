# Cart rewards progress bar (Dawn theme)

Multi-checkpoint progress for the slide-out cart: free shipping at **$100**, **20% off** messaging at **$150**, and an auto-managed **free gift** at **$200**. Built for a Shopify Dawn-based tech assessment.

## Live preview

Submit your **unpublished theme preview URL** from Shopify admin (**Online Store → Themes → … → Preview**) with the assessor. This repo does not host a link.

## What was built

| Deliverable | Location |
|-------------|----------|
| Progress UI | `snippets/cart-progress-bar.liquid` |
| Drawer integration | `snippets/cart-drawer.liquid` (renders snippet when `show_free_shipping_bar` is enabled) |
| Logic, Cart API, DOM | `assets/cart-progress.js` |
| Scoped styles | `assets/cart-progress.css` |
| Theme settings (thresholds, gift product, toggle) | `config/settings_schema.json` |
| Storefront strings | `locales/en.default.json` (`sections.cart.progress.*`) |
| Setting labels (editor) | `locales/en.default.schema.json` |

**Discounts:** Free shipping and **20% off at $150** are expected to be configured in **Shopify Admin** (e.g. automatic discounts / shipping rules). The bar only **communicates** progress; it does not create discounts.

## Technical approach

1. **Cart total** — `GET /cart.js`, sum `final_line_price` for all lines **except** the configured gift product so the gift does not push the subtotal over the tier you are measuring.

2. **Tiers** — Thresholds in **cents** from data attributes (settings → Liquid → `data-*`). `getCurrentThreshold()` compares subtotal to tier 1 / 2 / 3.

3. **Bar fill** — Checkpoints sit at **⅓, ⅔, and 100%** of the track (wireframe). Fill uses **segment-wise** mapping: each dollar band ($0–T1, T1–T2, T2–T3) maps to that third of the bar so the gold line never crosses a dot before the tier is actually reached. (A single linear `subtotal / $200` bar would visually pass the middle dot before $150.)

4. **Real-time updates** — Dawn’s `subscribe(PUB_SUB_EVENTS.cartUpdate, …)` (same channel `cart.js` uses after quantity changes) plus **MutationObserver** on `cart-drawer-items` and `#CartDrawer-CartItems` so the bar still updates if the DOM changes without a matching event.

5. **Free gift** — When subtotal ≥ tier 3: `POST /cart/add.js` with line item property `_promo_gift: 'true'`. When subtotal &lt; tier 3: `POST /cart/change.js` to set that line’s quantity to **0** (only lines with `_promo_gift` are removed; the same product added manually is left alone). After add/remove, **`publish(cart-update)`** with a non–`cart-items` source triggers the theme to refetch cart sections so the drawer list and header bubble match the API without a full reload.

6. **Variant resolution** — `GET /products/{handle}.json` (handle from theme setting) to read `product.id` and first variant id for `/cart/add.js`.

## Free gift product

The free gift configured for the $200 tier is **Microfiber cleaning cloth set**: a low-cost, practical add-on customers can actually use alongside the store’s leather products (wallets and similar goods) for care and cleaning. The theme points at this product via **Theme settings → Cart → Free gift product**. The line is added and removed automatically through the Cart API with a `_promo_gift` property so only the promo-generated line is removed when the cart drops below the threshold.

## Merchant configuration

- Enable **Show cart progress bar** and set **Free shipping / Discount / Gift** thresholds (defaults 100 / 150 / 200).
- Set **Free gift product** to **Microfiber cleaning cloth set** (or your chosen SKU; the demo uses this product).
