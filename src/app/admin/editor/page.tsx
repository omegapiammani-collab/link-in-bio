import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { isUuid } from '@/lib/domain/draft-contract.mjs';
import { DraftEditor } from './draft-editor';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ pageId?: string | string[] }> };

export default async function EditorPage({ searchParams }: Props) {
  const owner = await getOwner();
  if (!owner) redirect('/login');
  const params = await searchParams;
  // Both the server API and this page must opt in. Never infer write access
  // from the URL itself; the API still verifies the Owner session and origin.
  const canUseExistingDraft = process.env.PHASE2_DRAFT_WRITE_ENABLED === 'true';
  const pageId = typeof params.pageId === 'string' && isUuid(params.pageId)
    ? params.pageId : undefined;
  const draftPageId = canUseExistingDraft ? pageId : undefined;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 space-y-6">
      <Link href="/admin" className="text-sm">กลับไปแผงควบคุม</Link>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Phase 2 · Editor Preview</p>
        <h1 className="text-3xl font-bold">ทดลองจัดหน้า Link-in-Bio</h1>
        <p className="text-slate-600">
          {draftPageId
            ? 'โหมดทดสอบฉบับร่างที่มีอยู่แล้ว: ตรวจสิทธิ์ Owner และตรวจ revision ก่อนบันทึก ยังไม่เผยแพร่'
            : 'โหมดตัวอย่างส่วนตัว: ข้อมูลอยู่ในหน้านี้ชั่วคราว ยังไม่มีการบันทึกลงฐานข้อมูลหรือเผยแพร่'}
        </p>
      </header>
      <DraftEditor key={draftPageId ?? 'preview'} draftPageId={draftPageId} />
    </main>
  );
}
