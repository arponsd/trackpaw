export interface Preset {
  name: string;
  description: string;
  events: StandardEvent[];
}

export interface StandardEvent {
  name: string;
  description: string;
  properties: string[];
}

export const presets: Record<string, Preset> = {
  saas: {
    name: 'SaaS',
    description: 'Software-as-a-Service products',
    events: [
      { name: 'sign_up', description: 'User creates an account', properties: ['method', 'plan', 'referrer'] },
      { name: 'login', description: 'User logs in', properties: ['method'] },
      { name: 'onboarding_started', description: 'User starts onboarding', properties: [] },
      { name: 'onboarding_completed', description: 'User finishes onboarding', properties: ['duration_seconds'] },
      { name: 'feature_used', description: 'User uses a feature', properties: ['feature_name', 'feature_category'] },
      { name: 'subscription_started', description: 'User starts a paid plan', properties: ['plan', 'price', 'interval'] },
      { name: 'subscription_cancelled', description: 'User cancels subscription', properties: ['plan', 'reason'] },
      { name: 'subscription_upgraded', description: 'User upgrades plan', properties: ['from_plan', 'to_plan'] },
      { name: 'invite_sent', description: 'User invites a teammate', properties: ['method'] },
      { name: 'invite_accepted', description: 'Invited user joins', properties: [] },
      { name: 'support_ticket_created', description: 'User opens support ticket', properties: ['category'] },
      { name: 'feedback_submitted', description: 'User submits feedback', properties: ['type', 'rating'] },
    ],
  },
  ecommerce: {
    name: 'E-Commerce',
    description: 'Online stores and marketplaces',
    events: [
      { name: 'product_viewed', description: 'User views a product', properties: ['product_id', 'product_name', 'category', 'price'] },
      { name: 'product_searched', description: 'User searches for products', properties: ['query', 'results_count'] },
      { name: 'add_to_cart', description: 'User adds item to cart', properties: ['product_id', 'product_name', 'price', 'quantity'] },
      { name: 'remove_from_cart', description: 'User removes item from cart', properties: ['product_id', 'product_name'] },
      { name: 'checkout_started', description: 'User begins checkout', properties: ['cart_total', 'item_count'] },
      { name: 'checkout_completed', description: 'User completes purchase', properties: ['order_id', 'total', 'item_count', 'payment_method'] },
      { name: 'checkout_abandoned', description: 'User leaves during checkout', properties: ['step', 'cart_total'] },
      { name: 'coupon_applied', description: 'User applies a discount code', properties: ['coupon_code', 'discount_amount'] },
      { name: 'wishlist_added', description: 'User adds to wishlist', properties: ['product_id', 'product_name'] },
      { name: 'review_submitted', description: 'User submits a review', properties: ['product_id', 'rating'] },
      { name: 'refund_requested', description: 'User requests a refund', properties: ['order_id', 'reason'] },
    ],
  },
  media: {
    name: 'Media / Content',
    description: 'Blogs, news sites, streaming, and content platforms',
    events: [
      { name: 'content_viewed', description: 'User views content', properties: ['content_id', 'content_type', 'category', 'author'] },
      { name: 'content_started', description: 'User starts consuming content', properties: ['content_id', 'content_type'] },
      { name: 'content_completed', description: 'User finishes content', properties: ['content_id', 'duration_seconds'] },
      { name: 'content_shared', description: 'User shares content', properties: ['content_id', 'platform'] },
      { name: 'content_bookmarked', description: 'User saves content', properties: ['content_id'] },
      { name: 'comment_posted', description: 'User posts a comment', properties: ['content_id'] },
      { name: 'search_performed', description: 'User searches', properties: ['query', 'results_count'] },
      { name: 'newsletter_subscribed', description: 'User subscribes to newsletter', properties: ['source'] },
      { name: 'ad_clicked', description: 'User clicks an ad', properties: ['ad_id', 'placement'] },
      { name: 'paywall_hit', description: 'User encounters paywall', properties: ['content_id'] },
      { name: 'subscription_started', description: 'User subscribes', properties: ['plan', 'price'] },
    ],
  },
};

export function getPresetNames(): string[] {
  return Object.keys(presets);
}

export function formatEventsAsCode(events: StandardEvent[]): string {
  const lines = events.map((e) => {
    const props = e.properties.length > 0 ? e.properties.map((p) => `'${p}'`).join(', ') : '';
    return `  // ${e.description}\n  // trackpaw.track('${e.name}'${props ? `, { ${props} }` : ''})`;
  });

  return `// ─── Standard Events ──────────────────────────────────\n// Copy-paste these into your app where the actions happen.\n//\n${lines.join('\n\n')}\n`;
}
