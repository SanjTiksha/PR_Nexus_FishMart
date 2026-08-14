import { Helmet } from 'react-helmet';
import { COMPANY_EMAILS, mailto } from '../data/companyEmails';

const POLICY_LAST_UPDATED = '14 August 2026';

const PrivacyPolicy = ({ shopInfo }) => {
  const companyName = shopInfo?.name || 'PR Nexus FishMart';
  const phone = shopInfo?.phone || '+919096205136';
  const whatsapp = shopInfo?.whatsapp || shopInfo?.phone?.replace(/[^0-9]/g, '') || '919096205136';
  const address =
    shopInfo?.address ||
    'PR Nexus Group Office, Utkarsh Apartment, Near TVS Service Center, Near Tilak Smarak Mandir Chowk, 1516, Sadashiv Peth, Pune – 411030';

  return (
    <div className="min-h-screen bg-cyan-50">
      <Helmet>
        <title>Privacy Policy | PR Nexus FishMart</title>
        <meta
          name="description"
          content="Privacy Policy for PR Nexus FishMart, a venture of PR Nexus Group. How we collect, use, and protect information when you order fresh fish online."
        />
      </Helmet>

      <section className="bg-gradient-to-br from-blue-600 to-gray-900 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-cyan-200 text-sm font-semibold tracking-[0.2em] uppercase mb-3">
              {companyName}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Privacy Policy</h1>
            <p className="text-xl md:text-2xl text-cyan-50 max-w-3xl mx-auto">
              How we handle information when you use PR Nexus FishMart
            </p>
            <p className="text-cyan-100/90 text-sm mt-4">Last Updated: {POLICY_LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-gray-700 leading-relaxed">
          <div>
            <p className="text-lg">
              PR Nexus FishMart is a venture of PR Nexus Group. This Privacy Policy explains what
              information we collect through the PR Nexus FishMart website and related ordering
              experience, how that information is used, and how you can contact us.
            </p>
            <p className="mt-4">
              We do not require customers to create an account or log in to browse fish rates or
              place an order.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Information we collect</h2>
            <p className="mb-3">
              When you place an order, we collect the details needed to confirm payment and deliver
              your fish:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Customer name</li>
              <li>Mobile number (verified by one-time password before payment)</li>
              <li>Delivery address and, if you confirm it, a map pin / GPS location</li>
              <li>Delivery date and time-slot preference</li>
              <li>Order items, quantities, prices, discounts, delivery charges, and payable amount</li>
              <li>
                UPI payment reference / UTR that you enter after paying in your UPI app
              </li>
            </ul>
            <p className="mt-4">
              If you submit a customer review, we collect the name, rating, and comment you provide.
            </p>
            <p className="mt-4">
              We do not collect a customer email address as part of checkout. We do not collect
              payment card numbers, UPI PINs, or internet banking passwords.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">How we use information</h2>
            <p>We use order and contact information to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Process, fulfil, and deliver your order</li>
              <li>Verify your mobile number before payment</li>
              <li>Record the amount payable and the UTR you submit</li>
              <li>Allow our team to confirm payment and coordinate delivery</li>
              <li>Respond if you contact us by phone, WhatsApp, or email</li>
              <li>Publish reviews that you choose to submit</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Order and delivery processing</h2>
            <p>
              Completed orders are stored so we can prepare the catch, verify payment, and deliver to
              the address and location you confirmed. Delivery staff may use the address, mobile
              number, and map location from your order to reach you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Communication with customers</h2>
            <p>
              You may contact us through WhatsApp, phone, or the company email addresses shown on
              this website. WhatsApp opens in your own WhatsApp application. We do not operate a
              separate in-app chat account system. After an order is recorded, you may optionally
              send the order summary to us on WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Payment processing</h2>
            <p>
              Payment is made by UPI using your own UPI application (for example Google Pay, PhonePe,
              Paytm, or BHIM). PR Nexus FishMart shows a payee UPI ID and amount. We do not process
              card payments on this website. After you pay, you enter the UTR / transaction ID so we
              can match the payment to your order. Your UPI app, not this website, handles your UPI
              PIN and bank credentials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Cookies and local storage</h2>
            <p>
              This website uses browser local storage on your device to remember your shopping cart,
              favourite items, delivery date/slot preference, display theme, and similar site
              settings. A short-lived copy of delivery details may be kept in local storage during
              checkout. This information stays in your browser unless you clear site data. We do not
              use third-party advertising cookies or Google Analytics on this website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Third-party services</h2>
            <p className="mb-3">
              To run the website and complete orders, we use:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Google Firebase / Firestore, to store catalogue data and customer orders</li>
              <li>MSG91, to send the checkout mobile OTP, with H-Captcha as part of that check</li>
              <li>UPI applications, to complete payment on your device</li>
              <li>WhatsApp, if you choose to message us</li>
              <li>Map services (including Leaflet / OpenStreetMap tiles and Google Maps links) for delivery location</li>
              <li>Website hosting, to serve the FishMart site</li>
            </ul>
            <p className="mt-4">
              Those providers may process technical information such as IP address or device type as
              part of operating their services. This website does not itself collect IP addresses in
              the ordering forms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Data sharing</h2>
            <p>
              We do not sell customer information. We share order details only as needed to fulfil
              the order (for example with our team and delivery staff) and with the service providers
              listed above. Admin access to the website is limited to authorised PR Nexus FishMart
              management accounts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Data retention</h2>
            <p>
              Order records are kept so we can fulfil deliveries, verify payment, and handle
              follow-up. Cart and preference data in your browser remain until you clear them.
              Reviews remain until they are removed by our team. If you want an order or review
              updated or removed, contact us using the details below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Data security</h2>
            <p>
              Orders are stored in our cloud database and checkout uses mobile OTP verification
              before payment. No method of transmission or storage is completely secure. Please do
              not share your UPI PIN, OTP, or banking passwords with anyone, including our staff.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your choices</h2>
            <p>
              You can browse without placing an order. You can clear cart and other site data from
              your browser. You can decline location access; a delivery location must still be
              confirmed on the map to complete checkout. To ask about personal information we hold
              on an order, contact us with your order details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Children&apos;s privacy</h2>
            <p>
              PR Nexus FishMart is a seafood ordering website for general customers. We do not
              knowingly collect personal information from children. If you believe a child has
              provided information through an order, please contact us and we will review it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Changes to this Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The “Last Updated” date at the
              top of this page will change when we do. Continued use of the website after an update
              means you should review the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Contact</h2>
            <p className="mb-4">
              For privacy questions, contact PR Nexus FishMart:
            </p>
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 p-4 sm:p-5 space-y-2 text-gray-800">
              <p className="font-semibold">{companyName}</p>
              <p>A venture of PR Nexus Group</p>
              <p>{address}</p>
              <p>
                Phone:{' '}
                <a href={`tel:${phone}`} className="text-blue-700 hover:underline">
                  {phone}
                </a>
              </p>
              <p>
                WhatsApp:{' '}
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  {whatsapp}
                </a>
              </p>
              <p>
                Email:{' '}
                <a
                  href={mailto(COMPANY_EMAILS.info, 'Privacy enquiry - PR Nexus FishMart')}
                  className="text-blue-700 hover:underline"
                >
                  {COMPANY_EMAILS.info}
                </a>
              </p>
              <p>
                Sales:{' '}
                <a
                  href={mailto(COMPANY_EMAILS.sales, 'Sales enquiry - PR Nexus FishMart')}
                  className="text-blue-700 hover:underline"
                >
                  {COMPANY_EMAILS.sales}
                </a>
              </p>
              <p>
                Support:{' '}
                <a
                  href={mailto(COMPANY_EMAILS.support, 'Support - PR Nexus FishMart')}
                  className="text-blue-700 hover:underline"
                >
                  {COMPANY_EMAILS.support}
                </a>
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
