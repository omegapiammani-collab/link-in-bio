// Pure fail-closed identity matching, shared by server authorization and tests.
const AUTH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function configuredOwnerId(value) {
  if (typeof value !== 'string' || !AUTH_UUID_RE.test(value) ||
      value.toLowerCase() === '00000000-0000-0000-0000-000000000000') return null;
  return value.toLowerCase();
}
export function isVerifiedOwner(expectedId, user, error) {
  const configured = configuredOwnerId(expectedId);
  return configured !== null && !error && user !== null &&
    typeof user === 'object' && typeof user.id === 'string' &&
    user.id.toLowerCase() === configured;
}
