// Shared strict JSON contract for Phase 2 draft editing (no server-only dependencies).
const MAX_LINKS=20;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value) { return typeof value==='string' && UUID_RE.test(value); }
export function validExternalUrl(value) {
  if(typeof value!=='string'||value.length<8||value.length>2048||/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const parsed=new URL(value);
    return (parsed.protocol==='https:'||parsed.protocol==='http:') &&
      Boolean(parsed.hostname.includes('.')) &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname) &&
      !parsed.hostname.endsWith('.localhost') && !parsed.hostname.endsWith('.local') &&
      !parsed.username && !parsed.password;
  } catch { return false; }
}
export function normalizeDraftDocument(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('draft_invalid');
  const {name,description,links}=input;
  if(typeof name!=='string'||!name.trim()||name.length>80) throw new Error('profile_name_invalid');
  if(typeof description!=='string'||description.length>500) throw new Error('profile_description_invalid');
  if(!Array.isArray(links)||links.length>MAX_LINKS) throw new Error('draft_links_invalid');
  const seen=new Set();
  const normalized=links.map((link)=>{
    if(!link||typeof link!=='object'||Array.isArray(link)) throw new Error('draft_link_invalid');
    const {id,title,url,active}=link;
    if(!isUuid(id)||seen.has(id)) throw new Error('draft_link_id_invalid');
    seen.add(id);
    if(typeof title!=='string'||!title.trim()||title.length>100) throw new Error('draft_link_title_invalid');
    if(!validExternalUrl(url)||typeof active!=='boolean') throw new Error('draft_link_url_invalid');
    return {id,title:title.trim(),url,active};
  });
  return {name:name.trim(),description,links:normalized};
}
