const FreeDeliveryBenefit = () => (
  <div
    className="w-full border-y border-cyan-100 bg-cyan-50/80"
    role="note"
    aria-label="FishMart free delivery benefit"
  >
    <div className="max-w-7xl mx-auto flex justify-center px-3 sm:px-6 lg:px-8 py-3 min-[769px]:py-3.5">
      <div
        className="
          inline-flex items-center justify-center mx-auto
          flex-col sm:flex-row
          gap-0.5 sm:gap-3
          rounded-full border border-cyan-200 bg-white
          px-5 py-2 sm:px-6 sm:py-2
          shadow-sm
        "
      >
        <p className="text-sm sm:text-[15px] font-extrabold tracking-wide text-[#087EA4] leading-tight whitespace-nowrap">
          🚚 FREE DELIVERY
        </p>
        <span
          className="hidden sm:block h-4 w-px shrink-0 bg-cyan-200"
          aria-hidden="true"
        />
        <p className="text-[11px] sm:text-xs text-slate-600 text-center leading-snug">
          <span className="block sm:inline">On eligible orders</span>
          <span className="hidden sm:inline mx-1.5 text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="block sm:inline text-slate-500 sm:text-slate-600">
            Conditions apply
          </span>
        </p>
      </div>
    </div>
  </div>
);

export default FreeDeliveryBenefit;
