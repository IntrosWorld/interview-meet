import { requireUser } from './auth.js';

try {
  await requireUser();
  document.getElementById('account-gate')?.remove();
} catch {
  location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
}
