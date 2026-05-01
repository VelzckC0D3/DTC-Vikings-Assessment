const CART_PROGRESS_DEFAULT_STRINGS = {
  spend_free_shipping: 'Spend @@AMOUNT@@ more to unlock free shipping',
  spend_discount: 'Spend @@AMOUNT@@ more for 20% off',
  spend_gift: 'Spend @@AMOUNT@@ more to unlock your free gift',
  free_shipping_unlocked: 'Free shipping unlocked!',
  discount_applied: '20% off applied to your order.',
  gift_added: 'Your free gift has been added to your cart.',
};

class CartProgressBar {
  constructor(element) {
    this.progressBar = element;
    if (!this.progressBar) return;

    this.thresholds = {
      1: (parseInt(this.progressBar.dataset.freeShippingThreshold, 10) || 100) * 100,
      2: (parseInt(this.progressBar.dataset.freeDiscountThreshold, 10) || 150) * 100,
      3: (parseInt(this.progressBar.dataset.freeGiftThreshold, 10) || 200) * 100,
    };
    this.freeGiftProductKey = this.progressBar.dataset.freeGiftProductId || '';
    this.freeGiftProductId = null;
    this.freeGiftVariantId = null;
    this.updateTimeout = null;
    this.isUpdating = false;
    this.isManagingGift = false;

    this.initializeVariantId();
    this.attachListeners();
    this.updateProgressBar();
  }

  async initializeVariantId() {
    if (!this.freeGiftProductKey) return;
    try {
      const response = await fetch(`/products/${this.freeGiftProductKey}.json`);
      const data = await response.json();
      if (!data.product) return;
      this.freeGiftProductId = data.product.id;
      if (data.product.variants?.length) {
        this.freeGiftVariantId = data.product.variants[0].id;
      }
    } catch (error) {
      console.error('Failed to fetch free gift product:', error);
    }
  }

  debouncedUpdate() {
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => this.updateProgressBar(), 200);
  }

  attachListeners() {
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      subscribe(PUB_SUB_EVENTS.cartUpdate, () => this.debouncedUpdate());
    }
    const onMut = () => this.debouncedUpdate();
    const cartDrawer = document.querySelector('cart-drawer-items');
    if (cartDrawer) {
      new MutationObserver(onMut).observe(cartDrawer, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    }
    const cartItems = document.querySelector('#CartDrawer-CartItems');
    if (cartItems) {
      new MutationObserver(onMut).observe(cartItems, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }
  }

  async refreshCartSections() {
    if (typeof publish !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;
    await publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-progress' });

    const bubble = document.getElementById('cart-icon-bubble');
    if (!bubble || typeof routes === 'undefined' || !routes.cart_url) return;
    try {
      const response = await fetch(`${routes.cart_url}?section_id=cart-icon-bubble`);
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const inner = html.querySelector('.shopify-section')?.innerHTML;
      if (inner) bubble.innerHTML = inner;
    } catch (error) {
      console.error('Failed to refresh cart icon bubble:', error);
    }
  }

  async fetchCartData() {
    try {
      const response = await fetch('/cart.js');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch cart data:', error);
      return null;
    }
  }

  findPromoGiftInCart(cartData) {
    if (!cartData?.items || !this.freeGiftProductId) return null;
    return cartData.items.find(
      (item) =>
        item.product_id == this.freeGiftProductId && item.properties?._promo_gift === 'true'
    );
  }

  findAnyGiftInCart(cartData) {
    if (!cartData?.items || !this.freeGiftProductId) return null;
    return cartData.items.find((item) => item.product_id == this.freeGiftProductId);
  }

  async addPromoGift() {
    if (!this.freeGiftProductId || !this.freeGiftVariantId) return false;
    const cartData = await this.fetchCartData();
    if (this.findAnyGiftInCart(cartData)) return false;

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: this.freeGiftVariantId,
              quantity: 1,
              properties: { _promo_gift: 'true' },
            },
          ],
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error adding promo gift:', error);
      return false;
    }
  }

  async removePromoGift(cartData) {
    const promoGift = this.findPromoGiftInCart(cartData);
    if (!promoGift) return false;

    const line = cartData.items.indexOf(promoGift) + 1;
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, quantity: 0 }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error removing promo gift:', error);
      return false;
    }
  }

  calculateCartTotal(cartData) {
    if (!cartData?.items) return 0;
    return cartData.items
      .filter((item) => item.product_id != this.freeGiftProductId)
      .reduce((sum, item) => sum + item.final_line_price, 0);
  }

  getCurrentThreshold(cartTotal) {
    if (cartTotal >= this.thresholds[3]) return 3;
    if (cartTotal >= this.thresholds[2]) return 2;
    if (cartTotal >= this.thresholds[1]) return 1;
    return 0;
  }

  /** Fill % matches checkpoints at ⅓, ⅔, 100%: each dollar tier maps to one third of the track. */
  getTrackFillPercent(cartTotalCents) {
    const [t1, t2, t3] = [this.thresholds[1], this.thresholds[2], this.thresholds[3]];
    const third = 100 / 3;
    const twoThirds = 200 / 3;

    if (cartTotalCents >= t3) return 100;
    if (cartTotalCents <= 0) return 0;
    if (cartTotalCents < t1) return (cartTotalCents / t1) * third;
    if (cartTotalCents < t2) {
      const span = t2 - t1;
      return span <= 0 ? third : third + ((cartTotalCents - t1) / span) * (twoThirds - third);
    }
    const span = t3 - t2;
    return span <= 0 ? twoThirds : twoThirds + ((cartTotalCents - t2) / span) * (100 - twoThirds);
  }

  getStrings() {
    return window.cartProgressStrings || CART_PROGRESS_DEFAULT_STRINGS;
  }

  formatMoney(cents) {
    return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
  }

  createMessageLine(template, remainingCents, lineModifier) {
    const p = document.createElement('p');
    p.className = ['cart-progress-bar__line', lineModifier].filter(Boolean).join(' ');
    if (!template.includes('@@AMOUNT@@')) {
      p.textContent = template;
      return p;
    }
    const amount = this.formatMoney(remainingCents);
    template.split('@@AMOUNT@@').forEach((segment, index, arr) => {
      if (segment) p.appendChild(document.createTextNode(segment));
      if (index < arr.length - 1) {
        const span = document.createElement('span');
        span.className = 'cart-progress-bar__accent';
        span.textContent = amount;
        p.appendChild(span);
      }
    });
    return p;
  }

  renderMessages(messageRoot, cartTotal, currentThreshold) {
    if (!messageRoot) return;
    const s = this.getStrings();
    const { thresholds: t } = this;
    messageRoot.replaceChildren();

    const add = (tpl, cents, mod) => messageRoot.appendChild(this.createMessageLine(tpl, cents, mod));

    if (currentThreshold === 0) {
      add(s.spend_free_shipping, t[1] - cartTotal, null);
      return;
    }
    if (currentThreshold === 1) {
      add(s.free_shipping_unlocked, 0, 'cart-progress-bar__line--success');
      add(s.spend_discount, t[2] - cartTotal, null);
      return;
    }
    if (currentThreshold === 2) {
      add(s.free_shipping_unlocked, 0, 'cart-progress-bar__line--success');
      add(s.discount_applied, 0, 'cart-progress-bar__line--success');
      add(s.spend_gift, t[3] - cartTotal, null);
      return;
    }
    add(s.free_shipping_unlocked, 0, 'cart-progress-bar__line--success');
    add(s.discount_applied, 0, 'cart-progress-bar__line--success');
    add(s.gift_added, 0, 'cart-progress-bar__line--success');
  }

  async updateProgressBar() {
    if (!document.contains(this.progressBar)) return;
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const cartData = await this.fetchCartData();
      if (!cartData) return;

      const cartTotal = this.calculateCartTotal(cartData);
      const tier = this.getCurrentThreshold(cartTotal);
      this.progressBar.dataset.tier = String(tier);

      const fillPct = this.getTrackFillPercent(cartTotal);
      const fillEl = this.progressBar.querySelector('#cart-progress-fill');
      if (fillEl) fillEl.style.width = `${fillPct}%`;
      const trackEl = this.progressBar.querySelector('#cart-progress-track');
      if (trackEl) trackEl.setAttribute('aria-valuenow', String(Math.round(fillPct)));

      this.renderMessages(this.progressBar.querySelector('#cart-progress-message'), cartTotal, tier);

      this.progressBar.querySelectorAll('.cart-progress-bar__checkpoint').forEach((el) => {
        el.classList.toggle('is-active', parseInt(el.dataset.threshold, 10) <= tier);
      });

      if (tier >= 3) {
        if (!this.findPromoGiftInCart(cartData) && !this.findAnyGiftInCart(cartData) && !this.isManagingGift) {
          this.isManagingGift = true;
          try {
            if (await this.addPromoGift()) await this.refreshCartSections();
          } finally {
            this.isManagingGift = false;
          }
        }
      } else if (this.findPromoGiftInCart(cartData) && !this.isManagingGift) {
        this.isManagingGift = true;
        try {
          if (await this.removePromoGift(cartData)) await this.refreshCartSections();
        } finally {
          this.isManagingGift = false;
        }
      }
    } finally {
      this.isUpdating = false;
    }
  }
}

class CartProgressBarManager {
  constructor() {
    this.instances = new Map();
    this.initializeExisting();
    new MutationObserver(() => this.initializeExisting()).observe(document.body, {
      subtree: true,
      childList: true,
    });
  }

  initializeExisting() {
    document.querySelectorAll('.cart-progress-bar').forEach((el) => {
      if (!this.instances.has(el)) this.instances.set(el, new CartProgressBar(el));
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CartProgressBarManager());
} else {
  new CartProgressBarManager();
}
