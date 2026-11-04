import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { SignOutButton } from './sign-out-button';
import { MediaSmokeTest } from './media-smoke-test';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 const owner=await getOwner();
 if(!owner) redirect('/login');
 const canListPages = process.env.PHASE2_PAGE_LIST_ENABLED === 'true';
 const canCreateDraft = process.env.PHASE2_PAGE_CREATE_ENABLED === 'true' &&
   process.env.PHASE2_DRAFT_WRITE_ENABLED === 'true';
 return <main className="mx-auto max-w-2xl px-6 py-20 space-y-5">
  <p className="text-sm text-slate-500">Foundation · Owner-only</p>
  <h1 className="text-3xl font-bold">แผงควบคุม</h1>
  <p>บัญชี Owner ได้รับการยืนยันแล้ว</p>
  <p className="text-sm text-amber-800">Phase 2 เป็นตัวอย่างในหน่วยความจำ ยังไม่บันทึกหรือเผยแพร่</p>
  <p className="text-sm text-slate-500">การเผยแพร่ยังปิดอยู่ และการสร้างฉบับร่างเปิดได้เฉพาะสภาพแวดล้อมทดสอบที่กำหนด</p>
  <Link href="/admin/editor" className="inline-block rounded-lg bg-slate-900 px-4 py-3 text-white no-underline">ทดลองเครื่องมือจัดหน้า (Phase 2)</Link>
  {canListPages && <Link href="/admin/pages" className="block rounded-lg border px-4 py-3">ดูรายการหน้าทั้งหมด (Owner เท่านั้น)</Link>}
  {canCreateDraft && <Link href="/admin/new" className="block rounded-lg border px-4 py-3">สร้างหน้าฉบับร่าง (เฉพาะทดสอบ)</Link>}
  <MediaSmokeTest/>
  <SignOutButton/>
 </main>;
}
