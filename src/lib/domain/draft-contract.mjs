// Shared strict JSON contract for Phase 2 draft editing (no server-only dependencies).
const MAX_LINKS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
export function isUuid(value) { return typeof value === 'string' && UUID_RE.test(value); }

export function validExternalUrl(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 2048 ||
      /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;

    // Require a conventional DNS hostname. URL() canonicalizes decimal/octal/hex
    // IPv4 notation, so IPv4 literals are rejected *after* parsing.
    const host = parsed.hostname.toLowerCase();
    if (host.startsWith('[') || host.endsWith('.') || host.length > 253) return false;
    const labels = host.split('.');
    if (labels.length < 2 || labels.some(label => !HOST_LABEL_RE.test(label))) return false;
    if (labels.every(label => /^\d+$/.test(label))) return false;
    const tld = labels.at(-1);
    if (!tld || /^\d+$/.test(tld)) return false;
    if (['localhost', 'local', 'internal', 'invalid', 'test'].includes(tld)) return false;
    if (host === 'home.arpa' || host.endsWith('.home.arpa')) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeDraftDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('draft_invalid');
  const { name, description, links } = input;
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('profile_name_invalid');
  if (typeof description !== 'string' || description.length > 500) throw new Error('profile_description_invalid');
  if (!Array.isArray(links) || links.length > MAX_LINKS) throw new Error('draft_links_invalid');
  const seen = new Set();
  const normalized = links.map(link => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) throw new Error('draft_link_invalid');
    const { id, title, url, active } = link;
    if (!isUuid(id) || seen.has(id)) throw new Error('draft_link_id_invalid');
    seen.add(id);
    if (typeof title !== 'string' || !title.trim() || title.length > 100) throw new Error('draft_link_title_invalid');
    if (!validExternalUrl(url) || typeof active !== 'boolean') throw new Error('draft_link_url_invalid');
    return { id, title: title.trim(), url, active };
  });
  return { name: name.trim(), description, links: normalized };
}
