import { Link } from 'react-router-dom';
import { COMPANY_EMAILS, PRIMARY_EMAIL, mailto } from '../data/companyEmails';

// shopInfo will be passed as props from App component

const COMPANY_STORY_IMAGE =
  'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80';
// Fresh seafood / salmon fillets — fish marketing brand visual
// Fallback local asset if remote image fails: /images/Fish_default_image.png

const About = ({ shopInfo }) => {
  const companyName = shopInfo?.name || 'PR Nexus FishMart';

  return (
    <div className="min-h-screen bg-cyan-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-cyan-200 text-sm font-semibold tracking-[0.2em] uppercase mb-3">
              Seafood Company
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About {companyName}</h1>
            <p className="text-xl md:text-2xl text-cyan-50 max-w-3xl mx-auto">
              A trusted seafood company delivering fresh quality fish to homes and businesses
            </p>
          </div>
        </div>
      </section>

      {/* Company Story */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
              <p className="text-lg text-gray-600 mb-6">
                {companyName} is a seafood company built on freshness, reliability, and fair pricing.
                We work with trusted supply partners to bring quality fish from landing to market —
                so every order reaches families and restaurants at its best.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                From daily retail customers to hospitality partners, our focus is consistent quality,
                transparent rates, and dependable service. Fresh catch, careful handling, and
                customer trust define how we operate every morning.
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  'Direct coastal sourcing',
                  'Wholesale & retail supply',
                  'Daily fresh arrivals',
                  'Quality-checked catch'
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-gray-700 bg-cyan-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-blue-600 font-bold">✓</span>
                    <span className="text-sm font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-start items-center">
                <Link
                  to="/fish"
                  className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold text-sm sm:text-base shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
                >
                  <span>View Fish Rates</span>
                  <span className="ml-2 text-base group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>

                <a
                  href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm sm:text-base shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <span className="text-base">💬</span>
                  <span>WhatsApp Now</span>
                </a>
              </div>
            </div>

            {/* Company brand panel — replaces old personal shop photo */}
            <div className="relative overflow-hidden rounded-2xl shadow-xl min-h-[420px]">
              <img
                src={COMPANY_STORY_IMAGE}
                alt={`${companyName} — fresh seafood`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/Fish_default_image.png';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-blue-950/55 to-blue-900/25" />

              <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-end p-6 sm:p-8 text-white">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 text-3xl">
                  🐟
                </div>
                <p className="text-cyan-200 text-xs font-semibold tracking-[0.25em] uppercase mb-2">
                  Fresh Every Morning
                </p>
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">
                  {companyName}
                </h3>
                <p className="text-cyan-50/90 text-base max-w-md mb-6">
                  Quality seafood for homes, hotels, and restaurants — sourced with care, delivered with trust.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-3 text-center">
                    <div className="text-xl font-bold">15+</div>
                    <div className="text-[11px] text-cyan-100/90">Years</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-3 text-center">
                    <div className="text-xl font-bold">B2B</div>
                    <div className="text-[11px] text-cyan-100/90">& Retail</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-3 text-center">
                    <div className="text-xl font-bold">Daily</div>
                    <div className="text-[11px] text-cyan-100/90">Fresh Catch</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership — company-focused, no individual names/photos */}
      <section className="py-16 bg-cyan-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Our Leadership</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Driven by the vision of PR Nexus Group
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="card p-8 sm:p-10 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-3xl mb-6 shadow-lg">
                🏢
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">PR Nexus Group</h3>
              <p className="text-blue-600 font-semibold mb-5">Parent Company</p>
              <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
                PR Nexus Group is committed to creating customer-focused businesses that prioritize
                quality, innovation, and long-term trust. {companyName} is built on that same foundation —
                delivering fresh, hygienic seafood with professionalism and care.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">15+</div>
                  <div className="text-sm text-gray-600">Years Industry Experience</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">1000+</div>
                  <div className="text-sm text-gray-600">Happy Customers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">Daily</div>
                  <div className="text-sm text-gray-600">Fresh Supply</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location & Contact */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Visit Us</h2>
            <p className="text-gray-600">Come experience fresh seafood from {companyName}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pb-24 lg:pb-16">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-4">📍</span>
                    <div>
                      <p className="font-medium text-gray-900">Address</p>
                      <p className="text-gray-600">{shopInfo.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-2xl mr-4">📞</span>
                    <div>
                      <p className="font-medium text-gray-900">Phone</p>
                      <a href={`tel:${shopInfo.phone}`} className="text-blue-600 hover:underline">
                        {shopInfo.phone}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <span className="text-2xl mr-4">📧</span>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">Email</p>
                      <a href={mailto(PRIMARY_EMAIL)} className="block text-blue-600 hover:underline">
                        {COMPANY_EMAILS.info}
                      </a>
                      <a href={mailto(COMPANY_EMAILS.sales)} className="block text-blue-600 hover:underline text-sm">
                        {COMPANY_EMAILS.sales}
                      </a>
                      <a href={mailto(COMPANY_EMAILS.support)} className="block text-blue-600 hover:underline text-sm">
                        {COMPANY_EMAILS.support}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-2xl mr-4">⏰</span>
                    <div>
                      <p className="font-medium text-gray-900">Working Hours</p>
                      <p className="text-gray-600">{shopInfo.workingHours}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="card p-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">🗺️ Find Us on the Map</h3>
                  <p className="text-gray-600">Visit PR Nexus FishMart – Fresh Every Morning!</p>
                </div>
                <button
                  onClick={() =>
                    window.open(
                      'https://www.google.com/maps/search/?api=1&query=18.5082296,73.848883',
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                  className="btn-primary px-6 py-2"
                >
                  Open in Maps
                </button>
              </div>
              <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                <iframe
                  title="PR Nexus FishMart Location"
                  src="https://www.google.com/maps?q=18.5082296,73.848883&hl=en&z=17&output=embed"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-[350px] md:h-[400px] border-0"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;

