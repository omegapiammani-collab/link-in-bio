import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { DraftEditor } from './draft-editor';

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
  const owner = await getOwner();
  if (!owner) redirect('/login');
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 space-y-6">
      <Link href="/admin" className="text-sm">กลับไปแผงควบคุม</Link>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Phase 2 · Editor Preview</p>
        <h1 className="text-3xl font-bold">ทดลองจัดหน้า Link-in-Bio</h1>
        <p className="text-slate-600">
          เครื่องมือทดลองส่วนตัวสำหรับ Owner เท่านั้น ข้อมูลอยู่ในหน้านี้ชั่วคราว
          ยังไม่มีการบันทึกลงฐานข้อมูล อัปโหลด หรือเผยแพร่
        </p>
      </header>
      <DraftEditor />
    </main>
  );
}
