import { Link } from 'react-router-dom';
import { COMPANY_EMAILS, mailto } from '../data/companyEmails';

const Footer = ({ shopInfo }) => {
  const currentYear = new Date().getFullYear();
  const lastUpdated = new Date(shopInfo.updatedOn).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <footer className="bg-gradient-to-t from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Shop Info */}
          <div>
            <h3 className="text-2xl font-bold mb-6 text-white">{shopInfo.name}</h3>
            <p className="text-gray-300 mb-3 text-lg">A Venture of PR Nexus Group</p>
            <p className="text-gray-300 mb-3">Fresh, hygienic seafood delivered daily with trusted quality.</p>
            <div className="space-y-2">
              <p className="text-gray-300">📍 {shopInfo.address}</p>
              <p className="text-gray-300">📞 {shopInfo.phone}</p>
              <p className="text-gray-300">🕒 {shopInfo.workingHours}</p>
            </div>
            <p className="text-gray-400 text-sm mt-4">Last Updated: {lastUpdated}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xl font-semibold mb-6 text-white">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2 flex items-center">
                  <span className="mr-2">🐟</span>
                  Buy Fish
                </Link>
              </li>
              <li>
                <Link to="/home" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2 flex items-center">
                  <span className="mr-2">🏠</span>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2 flex items-center">
                  <span className="mr-2">ℹ️</span>
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2 flex items-center">
                  <span className="mr-2">📞</span>
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-xl font-semibold mb-6 text-white">Get In Touch</h4>
            <div className="space-y-4">
              <a 
                href={`https://wa.me/${shopInfo.whatsapp || shopInfo.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center text-gray-300 hover:text-green-400 transition-all duration-300 hover:translate-x-2"
              >
                <span className="mr-3 text-xl">💬</span>
                <span>WhatsApp Now</span>
                <span className="ml-auto group-hover:translate-x-1 transition-transform duration-300">→</span>
              </a>
              <a
                href={mailto(COMPANY_EMAILS.info, 'Enquiry - PR Nexus FishMart')}
                className="group flex items-center text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2"
              >
                <span className="mr-3 text-xl">📧</span>
                <span>Info · {COMPANY_EMAILS.info}</span>
              </a>
              <a
                href={mailto(COMPANY_EMAILS.sales, 'Sales Enquiry - PR Nexus FishMart')}
                className="group flex items-center text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2"
              >
                <span className="mr-3 text-xl">🛒</span>
                <span>Sales · {COMPANY_EMAILS.sales}</span>
              </a>
              <a
                href={mailto(COMPANY_EMAILS.support, 'Support - PR Nexus FishMart')}
                className="group flex items-center text-gray-300 hover:text-blue-400 transition-all duration-300 hover:translate-x-2"
              >
                <span className="mr-3 text-xl">🛟</span>
                <span>Support · {COMPANY_EMAILS.support}</span>
              </a>
            </div>
            
            {/* Social icons hidden for first version */}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700/40 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {currentYear} {shopInfo.name}. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-3 md:mt-0 justify-center md:justify-end">
              <p
                className="text-sm font-normal italic tracking-wide opacity-90 flex items-center gap-2"
                style={{ color: '#6EC1E4', letterSpacing: '0.5px' }}
              >
                <span role="img" aria-label="brand icon">🐟</span>
                Powered by SanjTiksha Roots and Wings
              </p>
              <Link 
                to="/admin" 
                className="text-gray-500 hover:text-[#A7E0FF] text-xs transition-colors duration-300 opacity-60 hover:opacity-100"
                title="Admin Panel"
              >
                🔧 Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

