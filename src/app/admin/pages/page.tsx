import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PageRow = {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'trashed';
  visibility: 'public' | 'unlisted';
  updated_at: string;
};
const STATUS_LABEL: Record<PageRow['status'], string> = {
  draft: 'ฉบับร่าง',
  published: 'เผยแพร่',
  archived: 'เก็บถาวร',
  trashed: 'ลบแล้ว'
};

export default async function OwnerPages() {
  if (!await getOwner()) redirect('/login');
  if (process.env.PHASE2_PAGE_LIST_ENABLED !== 'true') redirect('/admin');

  const db = await createSupabaseServerClient();
  const { data, error } = await db.from('pages')
    .select('id,slug,status,visibility,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(50);
  const pages = (data ?? []) as PageRow[];
  const canEdit = process.env.PHASE2_DRAFT_WRITE_ENABLED === 'true';
  const canCreate = canEdit && process.env.PHASE2_PAGE_CREATE_ENABLED === 'true';

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <Link href="/admin" className="text-sm">กลับไปแผงควบคุม</Link>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Phase 2 · Owner only</p>
        <h1 className="text-3xl font-bold">หน้าทั้งหมด</h1>
        <p className="text-sm text-slate-600">
          แสดงข้อมูลส่วนตัวของ Owner สูงสุด 50 หน้า โดยยังไม่เปลี่ยนสถานะหรือเผยแพร่
        </p>
      </header>
      {canCreate && <Link href="/admin/new"
        className="inline-block rounded-lg bg-slate-900 px-4 py-3 text-white no-underline">
        สร้างหน้าฉบับร่างใหม่
      </Link>}
      {error ? (
        <p role="alert" className="rounded-lg border p-4 text-red-700">
          ไม่สามารถโหลดรายการหน้าได้ กรุณาลองอีกครั้ง
        </p>
      ) : pages.length === 0 ? (
        <p className="rounded-lg border p-6 text-slate-600">ยังไม่มีหน้าที่แสดงในรายการ</p>
      ) : (
        <ul className="space-y-3">
          {pages.map(page => (
            <li key={page.id} className="space-y-2 rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-semibold">{page.slug}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {STATUS_LABEL[page.status] ?? 'ไม่ทราบสถานะ'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                การมองเห็น: {page.visibility === 'public' ? 'สาธารณะ' : 'ไม่แสดงในรายการสาธารณะ'}
              </p>
              {canEdit && page.status === 'draft' && (
                <Link href={`/admin/editor?pageId=${encodeURIComponent(page.id)}`}
                  className="inline-block rounded border px-3 py-2 text-sm no-underline">
                  เปิดตัวแก้ไขฉบับร่าง
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
