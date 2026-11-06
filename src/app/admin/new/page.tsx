import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { NewPageForm } from './new-page-form';

export const dynamic = 'force-dynamic';

export default async function NewPage() {
  if (!await getOwner()) redirect('/login');
  if (process.env.PHASE2_PAGE_CREATE_ENABLED !== 'true' ||
      process.env.PHASE2_DRAFT_WRITE_ENABLED !== 'true') redirect('/admin');
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <Link href="/admin" className="text-sm">กลับไปแผงควบคุม</Link>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Phase 2 · Isolated test only</p>
        <h1 className="text-3xl font-bold">สร้างหน้าฉบับร่าง</h1>
        <p className="text-sm text-amber-800">
          ใช้งานได้เฉพาะสภาพแวดล้อมทดสอบที่เปิด Feature Flag สองตัวแล้ว
          การสร้างหน้านี้ไม่ใช่การเผยแพร่
        </p>
      </header>
      <NewPageForm />
    </main>
  );
}
