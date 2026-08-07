/**
 * PR Nexus Group department emails
 * Use these consistently across the website for client reach.
 */
export const COMPANY_EMAILS = {
  info: 'info@prnexusgroup.com',
  support: 'support@prnexusgroup.com',
  sales: 'sales@prnexusgroup.com',
  accounts: 'accounts@prnexusgroup.com',
  admin: 'admin@prnexusgroup.com'
};

/** Primary public contact email */
export const PRIMARY_EMAIL = COMPANY_EMAILS.info;

export const EMAIL_DEPARTMENTS = [
  {
    key: 'info',
    label: 'General Enquiries',
    email: COMPANY_EMAILS.info,
    description: 'Company information & general questions',
    icon: 'ℹ️'
  },
  {
    key: 'sales',
    label: 'Sales & Orders',
    email: COMPANY_EMAILS.sales,
    description: 'Bulk orders, rates & business enquiries',
    icon: '🛒'
  },
  {
    key: 'support',
    label: 'Customer Support',
    email: COMPANY_EMAILS.support,
    description: 'Help, feedback & service issues',
    icon: '🛟'
  },
  {
    key: 'accounts',
    label: 'Accounts',
    email: COMPANY_EMAILS.accounts,
    description: 'Billing, invoices & payments',
    icon: '🧾'
  },
  {
    key: 'admin',
    label: 'Admin',
    email: COMPANY_EMAILS.admin,
    description: 'Administrative & partnership matters',
    icon: '🏢'
  }
];

export const mailto = (email, subject = '', body = '') => {
  const parts = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${parts.length ? `?${parts.join('&')}` : ''}`;
};
