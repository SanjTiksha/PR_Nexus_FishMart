import { Link } from 'react-router-dom';
import {
  getActiveOffers,
  getOfferTypeMeta,
  formatOfferDiscountLabel,
} from '../utils/offerUtils';

const typeEmoji = {
  flash: '⚡',
  festival: '🎉',
  promotional: '✨',
  website_launch: '🚀',
  weekend: '☀️',
  general: '🏷️',
};

/**
 * Existing project seafood visual (HeroSlider asset) used when offer has no Banner Image.
 * Prefer admin `bannerImage` when present.
 */
const DEFAULT_OFFER_VISUAL = '/images/banner_3.png';

/** Pick one primary active offer by existing type priority (display only). */
const getPrimaryOffer = (offers = []) => {
  const active = getActiveOffers(offers);
  if (!active.length) return null;
  return [...active].sort(
    (a, b) => getOfferTypeMeta(a.type).priority - getOfferTypeMeta(b.type).priority,
  )[0];
};

const getApplicabilityNote = (offer, fishes = []) => {
  if (!offer) return '';
  if (offer.applyTo === 'entire_store') {
    return 'Valid on your entire order when cart qualifies';
  }
  if (offer.applyTo === 'selected_categories') {
    const cats = (offer.categoryIds || []).filter(Boolean);
    return cats.length
      ? `Applies to: ${cats.join(', ')}`
      : 'Applies to selected categories';
  }
  if (offer.applyTo === 'selected_products') {
    const ids = new Set((offer.productIds || []).map(String));
    const names = (fishes || [])
      .filter((f) => ids.has(String(f.id)))
      .map((f) => f.name)
      .slice(0, 4);
    if (names.length) {
      const more = ids.size > names.length ? ` +${ids.size - names.length} more` : '';
      return `Applies to: ${names.join(', ')}${more}`;
    }
    return 'Applies to selected products';
  }
  return '';
};

const getTermsLine = (offer) => {
  const parts = [];
  const min = Number(offer?.minimumOrderAmount) || 0;
  const max = Number(offer?.maximumDiscount) || 0;
  if (min > 0) parts.push(`Minimum order ₹${min}`);
  if (max > 0) parts.push(`Maximum discount ₹${max}`);
  if (offer?.endDate) parts.push(`Valid until ${offer.endDate}`);
  return parts.join(' • ');
};

/**
 * Premium storefront offer hero — one seamless full-bleed seafood image
 * with soft left readability wash (no hard text panel / vertical split).
 */
const SpecialOffersSection = ({
  fishData,
  shopNowTo = '/',
  shopNowHref,
  compact = false,
}) => {
  const primary = getPrimaryOffer(fishData?.offers || []);
  if (!primary) return null;

  const typeMeta = getOfferTypeMeta(primary.type);
  const discountLabel = formatOfferDiscountLabel(primary);
  const applicability = getApplicabilityNote(primary, fishData?.fishes || []);
  const terms = getTermsLine(primary);
  const supportingText =
    primary.description?.trim() ||
    'Fresh fish delivered fresh to your door.';
  const bannerFromOffer = String(primary.bannerImage || '').trim();
  const visualSrc = bannerFromOffer || DEFAULT_OFFER_VISUAL;
  const visualAlt = bannerFromOffer
    ? `${primary.title} offer banner`
    : 'Fresh seafood offer - fish curry, fish on ice, herbs and spices';

  const ctaClass =
    'inline-flex items-center justify-center gap-1.5 min-h-[42px] max-[400px]:min-h-[40px] min-[769px]:min-h-[48px] px-5 max-[400px]:px-4 min-[769px]:px-7 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm min-[769px]:text-base shadow-md transition-colors shrink-0';

  const cta = shopNowHref ? (
    <a href={shopNowHref} className={ctaClass}>
      Shop Now <span aria-hidden="true">→</span>
    </a>
  ) : (
    <Link to={shopNowTo} className={ctaClass}>
      Shop Now <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <section
      className={`${
        compact
          ? 'pt-2.5 pb-1 max-[400px]:pt-2 min-[769px]:pt-4 min-[769px]:pb-2'
          : 'pt-3 pb-1 min-[769px]:pt-6 min-[769px]:pb-3'
      } px-3 max-[400px]:px-2.5 min-[769px]:px-6 lg:px-8`}
      aria-label="Special offer"
    >
      <div className="max-w-7xl mx-auto">
        <div
          className={`
            relative overflow-hidden rounded-[18px] min-[769px]:rounded-3xl
            shadow-lg shadow-cyan-900/10 border border-cyan-100/60
            ${compact ? 'min-h-[200px] max-[400px]:min-h-[190px] min-[769px]:min-h-[240px]' : 'min-h-[220px] max-[400px]:min-h-[210px] min-[769px]:min-h-[280px] lg:min-h-[300px] xl:min-h-[320px]'}
          `}
        >
          {/* Full-bleed seafood photography — continuous across the banner */}
          <img
            src={visualSrc}
            alt={visualAlt}
            className="absolute inset-0 h-full w-full object-cover object-center max-[768px]:object-[55%_35%]"
          />

          {/* Very light cool wash so the photo stays vivid and matches site blues — not near-black */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-900/10 via-transparent to-cyan-700/10"
            aria-hidden="true"
          />

          {/*
            Localized left readability gradient only (ocean/cyan, not black).
            Soft fade into the photo — no rectangular panel / hard vertical edge.
          */}
          <div
            className="pointer-events-none absolute inset-0 max-[768px]:hidden"
            style={{
              background:
                'linear-gradient(90deg, rgba(12,74,110,0.62) 0%, rgba(14,116,144,0.38) 26%, rgba(8,145,178,0.16) 46%, rgba(14,165,233,0) 66%)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 hidden max-[768px]:block"
            style={{
              background:
                'linear-gradient(0deg, rgba(12,74,110,0.68) 0%, rgba(14,116,144,0.36) 38%, rgba(8,145,178,0.12) 62%, rgba(14,165,233,0) 88%)',
            }}
            aria-hidden="true"
          />

          {/* Offer copy — left ~40–45% on desktop; overlays image */}
          <div
            className="
              relative z-10 flex h-full min-h-[inherit] flex-col justify-center text-white
              w-full min-[769px]:w-[44%] lg:w-[42%]
              px-4 py-5 max-[400px]:px-3.5 max-[400px]:py-4
              min-[769px]:px-7 min-[769px]:py-7
              lg:px-9 lg:py-8
            "
          >
            <p className="inline-flex items-center gap-1.5 text-[11px] min-[769px]:text-xs font-bold uppercase tracking-[0.14em] text-orange-200 mb-1.5 min-[769px]:mb-2 drop-shadow-[0_1px_2px_rgba(12,74,110,0.55)]">
              <span aria-hidden="true">{typeEmoji[primary.type] || '🎉'}</span>
              {typeMeta.label}
            </p>

            <h2
              className="
                font-extrabold tracking-tight leading-[1.1] mb-1 min-[769px]:mb-1.5 text-white
                text-[24px] max-[400px]:text-[22px]
                min-[390px]:text-[26px] min-[414px]:text-[28px]
                min-[769px]:text-2xl lg:text-3xl xl:text-4xl
                drop-shadow-[0_1px_3px_rgba(12,74,110,0.55)]
              "
            >
              {primary.title}
            </h2>

            <p
              className="
                font-semibold text-amber-300 mb-1 min-[769px]:mb-1.5
                text-[17px] max-[400px]:text-[16px] min-[414px]:text-[19px]
                min-[769px]:text-xl lg:text-2xl
                drop-shadow-[0_1px_3px_rgba(12,74,110,0.5)]
              "
            >
              Get {discountLabel} Your Order
            </p>

            <p
              className="
                text-white/95 leading-snug mb-2 min-[769px]:mb-2 max-w-xl
                text-[13px] min-[414px]:text-[14px]
                min-[769px]:text-[15px]
                max-[768px]:line-clamp-2
                drop-shadow-[0_1px_2px_rgba(12,74,110,0.45)]
              "
            >
              {supportingText}
            </p>

            {applicability && (
              <p className="hidden min-[769px]:block text-xs sm:text-sm text-cyan-50/95 mb-3 font-medium drop-shadow-[0_1px_2px_rgba(12,74,110,0.4)]">
                {applicability}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 min-[769px]:gap-3">
              {cta}
              <span className="inline-flex items-center rounded-full bg-white/20 border border-white/50 px-2.5 py-1.5 min-[769px]:px-3 text-xs min-[769px]:text-sm font-bold text-white backdrop-blur-[2px] shrink-0 shadow-sm">
                {discountLabel}
              </span>
            </div>

            {terms && (
              <p className="mt-3 text-[11px] sm:text-xs text-white/90 leading-relaxed drop-shadow-[0_1px_2px_rgba(12,74,110,0.4)] max-[768px]:mt-2.5">
                {terms}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpecialOffersSection;
