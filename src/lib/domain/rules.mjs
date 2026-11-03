export const RESERVED_SLUGS=new Set(['admin','auth','api','login','en','_next','robots.txt','sitemap.xml','favicon.ico']);
export function validateSlug(value) {
 if(typeof value!=='string') return false;
 const slug=value.trim().toLowerCase();
 return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)&&!RESERVED_SLUGS.has(slug);
}
export function isBlockVisible(block, nowMillis) {
 if (!block?.is_active || !Number.isFinite(nowMillis)) return false;
 const start=block.schedule_start==null?null:Date.parse(block.schedule_start);
 const end=block.schedule_end==null?null:Date.parse(block.schedule_end);
 if ((start!==null&&!Number.isFinite(start))||(end!==null&&!Number.isFinite(end))) return false;
 return (start===null||nowMillis>=start)&&(end===null||nowMillis<end);
}
export function failSafeCachedBlockVisible(block, reliableClock, nowMillis) {
 if(block?.schedule_start!=null||block?.schedule_end!=null) return reliableClock&&isBlockVisible(block,nowMillis);
 return Boolean(block?.is_active);
}
