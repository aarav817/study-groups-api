import dns from 'dns';

/**
 * Validates the structure and domain validity of an email address.
 * Performs format validation, .edu constraint check, and DNS MX record lookup.
 */
export async function validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required.' };
  }

  const normalized = email.trim().toLowerCase();

  // Basic RFC 5322 regex for standard email syntax
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(normalized)) {
    return { valid: false, reason: 'Invalid email format.' };
  }

  // Enforce university .edu domain constraint
  if (!normalized.endsWith('.edu')) {
    return { valid: false, reason: 'Please provide a valid university email address ending in .edu (e.g. alex@stanford.edu).' };
  }

  const domain = normalized.split('@')[1];
  if (!domain) {
    return { valid: false, reason: 'Invalid email domain.' };
  }

  // Attempt DNS MX record resolution to check if domain receives mail
  try {
    const mxRecords = await dns.promises.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: `Domain ${domain} does not have valid mail exchange (MX) records.` };
    }
  } catch (err: any) {
    // If DNS query fails due to ENOTFOUND, ENODATA, SERVFAIL, domain cannot receive emails
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'ESERVFAIL') {
      return { valid: false, reason: `Domain ${domain} does not exist or has no active mail servers.` };
    }
    // For local/offline environments or network connectivity timeouts, allow graceful fallback
  }

  return { valid: true };
}
