import { COMPANY_EMAILS, EMAIL_DEPARTMENTS, PRIMARY_EMAIL, mailto } from '../data/companyEmails';

const MAP_SHARE_URL =
  'https://www.google.com/maps/search/?api=1&query=18.5082296,73.848883';
const MAP_EMBED_URL =
  'https://www.google.com/maps?q=18.5082296,73.848883&hl=en&z=17&output=embed';
// Office: PR Nexus Group Office, Utkarsh Apt, Near Tilak Smarak Mandir Chowk, Sadashiv Peth, Pune 411030

const Contact = ({ shopInfo }) => {
  const handleWhatsApp = () => {
    const phoneNumber = shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phoneNumber}`);
  };

  const handleEmail = () => {
    window.open(mailto(PRIMARY_EMAIL, 'Enquiry - PR Nexus FishMart'));
  };

  const handleDirections = () => {
    window.open(MAP_SHARE_URL);
  };

  return (
    <div className="min-h-screen bg-cyan-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
            <p className="text-xl md:text-2xl text-cyan-50 max-w-3xl mx-auto">
              Get in touch for the freshest fish and best prices
            </p>
          </div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Get In Touch</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We're here to help you get the freshest fish. Choose your preferred way to contact us.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* WhatsApp */}
            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">WhatsApp Us</h3>
              <p className="text-gray-600 mb-4">Quick messages and orders</p>
              <button
                onClick={handleWhatsApp}
                className="btn-primary w-full"
              >
                WhatsApp Now
              </button>
            </div>


            {/* Email */}
            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Email</h3>
              <p className="text-gray-600 mb-1">General: {COMPANY_EMAILS.info}</p>
              <p className="text-gray-500 text-sm mb-4">Sales: {COMPANY_EMAILS.sales}</p>
              <button
                onClick={handleEmail}
                className="btn-primary w-full"
              >
                Send Email
              </button>
            </div>

            {/* Directions */}
            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📍</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Visit Us</h3>
              <p className="text-gray-600 mb-4">Get directions to our shop</p>
              <button
                onClick={handleDirections}
                className="btn-primary w-full"
              >
                Get Directions
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Shop Details */}
      <section className="py-16 bg-cyan-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div className="card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop Information</h2>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">🏪</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Shop Name</h3>
                    <p className="text-gray-600">{shopInfo.name}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">🏢</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Group</h3>
                    <p className="text-gray-600">PR Nexus Group</p>
                    <p className="text-sm text-gray-500 mt-1">A Venture of PR Nexus Group</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">📍</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Address</h3>
                    <p className="text-gray-600">{shopInfo.address}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">📞</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Phone</h3>
                    <a 
                      href={`tel:${shopInfo.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {shopInfo.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">📧</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Primary Email</h3>
                    <a
                      href={mailto(PRIMARY_EMAIL)}
                      className="text-blue-600 hover:underline"
                    >
                      {PRIMARY_EMAIL}
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-4 mt-1">⏰</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Working Hours</h3>
                    <p className="text-gray-600">{shopInfo.workingHours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Section */}
            <div className="card p-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">🗺️ Find Us on the Map</h2>
                  <p className="text-gray-600">Visit PR Nexus FishMart – Fresh Every Morning!</p>
                </div>
                <button
                  onClick={handleDirections}
                  className="btn-primary px-6 py-2"
                >
                  Open in Maps
                </button>
              </div>
              <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                <iframe
                  title="PR Nexus FishMart Location"
                  src={MAP_EMBED_URL}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-[450px] border-0"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Department Emails */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Email the Right Team</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Reach PR Nexus Group faster — choose the department that matches your enquiry.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
            {EMAIL_DEPARTMENTS.map((dept) => (
              <a
                key={dept.key}
                href={mailto(dept.email, `${dept.label} - PR Nexus FishMart`)}
                className="card p-6 hover:scale-[1.02] transition-transform block"
              >
                <div className="text-3xl mb-3">{dept.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{dept.label}</h3>
                <p className="text-sm text-gray-600 mb-3">{dept.description}</p>
                <p className="text-blue-600 font-medium break-all">{dept.email}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 bg-cyan-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <p className="text-gray-600">Get what you need quickly</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href="/fish"
              className="card p-6 text-center hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-4">🐟</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">View Fish Rates</h3>
              <p className="text-gray-600">Check today's fish prices and availability</p>
            </a>

            <a
              href="/about"
              className="card p-6 text-center hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-4">ℹ️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">About Us</h3>
              <p className="text-gray-600">Learn more about our fish market</p>
            </a>

            <button
              onClick={handleWhatsApp}
              className="card p-6 text-center hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Order Now</h3>
              <p className="text-gray-600">Place your order via WhatsApp</p>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;

