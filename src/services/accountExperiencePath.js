export const isAccountExperiencePath = (pathname) => {
  const path = String(pathname || '').split('?')[0];
  return path === '/login' || path === '/account' || path.startsWith('/account/');
};
