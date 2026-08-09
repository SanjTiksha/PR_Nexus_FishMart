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
  website_launch: '🎉',
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
 * Premium storefront offer hero.
 * Mobile (≤768px): compact card with same seafood image as subtle right-side accent.
 * Desktop (≥769px): ~45/55 content + full-bleed seafood visual (unchanged).
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
  const minOrder = Number(primary.minimumOrderAmount) || 0;
  const supportingText =
    primary.description?.trim() ||
    'Fresh fish delivered fresh to your door.';
  const bannerFromOffer = String(primary.bannerImage || '').trim();
  const visualSrc = bannerFromOffer || DEFAULT_OFFER_VISUAL;
  const visualAlt = bannerFromOffer
    ? `${primary.title} offer banner`
    : 'Fresh seafood offer - fish and prawns on ice';

  const ctaClass =
    'inline-flex items-center justify-center min-h-[42px] max-[400px]:min-h-[40px] min-[769px]:min-h-[48px] px-5 max-[400px]:px-4 min-[769px]:px-7 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm min-[769px]:text-base shadow-md transition-colors shrink-0';

  const cta = shopNowHref ? (
    <a href={shopNowHref} className={ctaClass}>
      Shop Now
    </a>
  ) : (
    <Link to={shopNowTo} className={ctaClass}>
      Shop Now
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
        <div className="relative overflow-hidden rounded-[18px] min-[769px]:rounded-3xl shadow-xl border border-cyan-100/70 bg-gradient-to-br from-blue-800 via-cyan-700 to-teal-600">
          {/*
            Mobile-only subtle seafood accent (same image as desktop).
            Layering: banner bg → image → gradient → content (z-10).
          */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[50%] overflow-hidden min-[769px]:hidden"
            aria-hidden="true"
          >
            <img
              src={visualSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/75 to-cyan-800/20" />
          </div>

          <div
            className="
              relative z-[2] grid grid-cols-1
              max-[768px]:min-h-[190px]
              min-[769px]:grid-cols-[0.82fr_1fr] min-[769px]:min-h-[260px]
              lg:grid-cols-[0.8fr_1fr] lg:min-h-[280px]
              xl:min-h-[300px]
            "
          >
            {/* LEFT — offer copy */}
            <div
              className="
                relative z-10 flex flex-col justify-center text-white min-w-0
                px-4 py-4 max-[400px]:px-3.5 max-[400px]:py-3.5
                min-[769px]:px-7 min-[769px]:py-6
                lg:px-9 lg:py-7
              "
            >
              <p className="inline-flex items-center gap-1.5 text-[11px] min-[769px]:text-xs font-bold uppercase tracking-[0.14em] text-cyan-100 mb-1.5 min-[769px]:mb-2">
                <span aria-hidden="true">{typeEmoji[primary.type] || '🎉'}</span>
                {typeMeta.label}
              </p>

              <h2
                className="
                  font-extrabold tracking-tight leading-[1.1] mb-1 min-[769px]:mb-1.5
                  text-[24px] max-[400px]:text-[22px]
                  min-[390px]:text-[26px] min-[414px]:text-[28px]
                  min-[769px]:text-2xl lg:text-3xl xl:text-4xl
                "
              >
                {primary.title}
              </h2>

              <p
                className="
                  font-semibold text-orange-200 mb-1 min-[769px]:mb-1.5
                  text-[17px] max-[400px]:text-[16px] min-[414px]:text-[19px]
                  min-[769px]:text-xl lg:text-2xl
                "
              >
                Get {discountLabel} Your Order
              </p>

              <p
                className="
                  text-white/90 leading-snug mb-2 min-[769px]:mb-2 max-w-2xl
                  text-[13px] min-[414px]:text-[14px]
                  min-[769px]:text-[15px]
                  max-[768px]:line-clamp-2
                "
              >
                {supportingText}
              </p>

              {applicability && (
                <p className="hidden min-[769px]:block text-xs sm:text-sm text-cyan-100/95 mb-3 font-medium">
                  {applicability}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 min-[769px]:gap-3">
                {cta}
                <span className="inline-flex items-center rounded-full bg-white/15 border border-white/30 px-2.5 py-1.5 min-[769px]:px-3 text-xs min-[769px]:text-sm font-bold text-white backdrop-blur-sm shrink-0">
                  {discountLabel}
                </span>
              </div>

              {minOrder > 0 && (
                <p className="mt-2 text-[11px] text-white/75 leading-none min-[769px]:hidden">
                  Minimum order ₹{minOrder}
                </p>
              )}

              {terms && (
                <p className="mt-3 text-[11px] sm:text-xs text-white/75 leading-relaxed hidden min-[769px]:block">
                  {terms}
                </p>
              )}
            </div>

            {/* RIGHT — full-bleed seafood visual (desktop ≥769px only; unchanged) */}
            <div
              className="
                relative z-[1] overflow-hidden min-[769px]:rounded-l-none
                hidden min-[769px]:block
                min-[769px]:min-h-full
              "
            >
              <img
                src={visualSrc}
                alt={visualAlt}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />

              {/* Blend into left text column — no offer text on the image */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-28 lg:w-36 bg-gradient-to-r from-blue-900/85 via-cyan-800/40 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpecialOffersSection;
