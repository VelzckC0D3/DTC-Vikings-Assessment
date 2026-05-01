# Cart rewards progress bar (Dawn theme)

Multi-checkpoint progress for the slide-out cart: free shipping at **$100**, **20% off** messaging at **$150**, and an auto-managed **free gift** at **$200**. Built for a Shopify Dawn-based tech assessment.

## Assessment requirements (point by point)

### Thresholds

| Requirement | How it is met |
|---------------|----------------|
| **$100 — free shipping** | Tier 1 in `cart-progress.js` (`thresholds[1]`), default **100** from theme settings / Liquid `data-free-shipping-threshold`. |
| **$150 — free shipping + 20% off** | Tier 2 (`thresholds[2]`), default **150**. The **20% discount** is applied in **Shopify Admin** (automatic discount / rules); the bar **states** that tier in copy only. |
| **$200 — free shipping + 20% off + free gift** | Tier 3 (`thresholds[3]`), default **200**. Gift line added/removed via Cart API when subtotal crosses this amount. |

### Behavior

| Requirement | How it is met |
|---------------|----------------|
| **Progress bar fills proportionally from $0 to $200** | Fill width is **segment-wise**: each dollar band ($0→T1, T1→T2, T2→T3) maps to one segment of the bar so the fill matches tier progress and does not pass a checkpoint before that tier is reached (pure `subtotal ÷ $200` would look ahead of the $150 dot). |
| **Three checkpoints evenly spaced** | Three **equal-width columns** in the drawer (`flex` on `.cart-progress-bar__checkpoints`) so markers and labels stay readable inside Dawn’s `overflow: hidden` cart drawer. |
| **Label under each checkpoint** | `cart-progress-bar.liquid` + `sections.cart.progress.*` strings (e.g. “Free shipping $100”, “20% off $150”, “Free gift $200”). |
| **Dynamic message for current state** | `renderMessages()` in `cart-progress.js`: spend-to-next-tier copy, then unlocked lines per wireframe states A / B / C. |
| **All thresholds reached → full bar + active labels** | At tier 3, fill is **100%**, all checkpoints get `is-active`, and three success lines render. |
| **Free gift add/remove via Cart API** | `addPromoGift()` → `/cart/add.js` with `_promo_gift`; `removePromoGift()` → `/cart/change.js` with `quantity: 0` on the promo line only. |
| **Real time, no full page reload** | `subscribe(PUB_SUB_EVENTS.cartUpdate, …)`, `MutationObserver` on the drawer cart DOM, and `publish(cart-update)` after gift changes so sections refetch like the rest of Dawn. |

### Technical scope

| Requirement | How it is met |
|---------------|----------------|
| **Inject into cart drawer** | `snippets/cart-drawer.liquid` renders `cart-progress-bar` when **Show cart progress bar** is on. |
| **`/cart.js` for cart total** | `fetchCartData()` reads `/cart.js`; `calculateCartTotal()` sums `final_line_price` excluding the gift product. |
| **Vanilla JS for thresholds, DOM, gift** | `assets/cart-progress.js` only (no React/Tailwind/external libs). |
| **Scoped CSS, Dawn palette** | `assets/cart-progress.css` scoped under `.cart-progress-bar`, using Dawn tokens (`rgb(var(--color-foreground))`, etc.). |
| **Listen for cart updates** | Dawn’s **`cart-update`** pub/sub (same mechanism as `assets/cart.js`) plus **MutationObserver** so quantity changes still refresh the bar. |

### Deliverables

| Item | Location / note |
|------|-------------------|
| Liquid snippet | `snippets/cart-progress-bar.liquid` |
| JavaScript | `assets/cart-progress.js` |
| CSS | `assets/cart-progress.css` |
| Written explanation | This **README** |
| Preview link | See **Live preview** below (theme preview + storefront password). |

## Design

The wireframes used illustrative gold (`#C9A84C`) and green (`#7EB87A`). On **stock Dawn** (no separate brand color pack), the implementation keeps a **sober, native look**: fill and “unlocked” states use **comma-separated RGB triples** on `.cart-progress-bar` (`--cart-progress-fill-rgb`, `--cart-progress-active-rgb`) in the same shape Dawn uses for `rgb(var(--color-*))`, with **restrained** default values so the bar does not overpower the drawer. Merchants can point those variables at `var(--color-button)` in custom CSS if they want a strict scheme match. Copy and spacing lean on Dawn tokens (`--font-body-scale`, `rgb(var(--color-foreground))`, muted track) so the block reads as part of the default theme rather than a loud marketing strip.

## Live preview

**Theme preview (unpublished theme):**  
[https://dtc-vikings-assessment.myshopify.com/?_ab=0&_fd=0&_sc=1&key=e098a703eaae784a154164a643ea193b6edde707aafd076e1574f78e84938eb8&preview_theme_id=161904558292](https://dtc-vikings-assessment.myshopify.com/?_ab=0&_fd=0&_sc=1&key=e098a703eaae784a154164a643ea193b6edde707aafd076e1574f78e84938eb8&preview_theme_id=161904558292)

The storefront is password-protected. Use password: **`DTCVikings`**. After entering, open the cart drawer and add/remove line items to exercise the progress bar and free-gift behavior.

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

3. **Bar fill** — Fill uses **segment-wise** mapping: each dollar band ($0–T1, T1–T2, T2–T3) maps to one third of the bar so progress does not read past a tier before it is reached. Checkpoints are **three equal columns** in the drawer (flex) so labels stay inside Dawn’s clipped drawer; that matches the wireframe’s “even spacing” intent without overflowing the track.

4. **Real-time updates** — Dawn’s `subscribe(PUB_SUB_EVENTS.cartUpdate, …)` (same channel `cart.js` uses after quantity changes) plus **MutationObserver** on `cart-drawer-items` and `#CartDrawer-CartItems` so the bar still updates if the DOM changes without a matching event.

5. **Free gift** — When subtotal ≥ tier 3: `POST /cart/add.js` with line item property `_promo_gift: 'true'`. When subtotal &lt; tier 3: `POST /cart/change.js` to set that line’s quantity to **0** (only lines with `_promo_gift` are removed; the same product added manually is left alone). After add/remove, **`publish(cart-update)`** with a non–`cart-items` source triggers the theme to refetch cart sections so the drawer list and header bubble match the API without a full reload.

6. **Variant resolution** — `GET /products/{handle}.json` (handle from theme setting) to read `product.id` and first variant id for `/cart/add.js`.

## Free gift product

The free gift configured for the $200 tier is **Microfiber cleaning cloth set**: a low-cost, practical add-on customers can actually use alongside the store’s leather products (wallets and similar goods) for care and cleaning. The theme points at this product via **Theme settings → Cart → Free gift product**. The line is added and removed automatically through the Cart API with a `_promo_gift` property so only the promo-generated line is removed when the cart drops below the threshold.

## Merchant configuration

- Enable **Show cart progress bar** and set **Free shipping / Discount / Gift** thresholds (defaults 100 / 150 / 200).
- Set **Free gift product** to **Microfiber cleaning cloth set** (or your chosen SKU; the demo uses this product).
