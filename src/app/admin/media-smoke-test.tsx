'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const BUCKET = 'link-in-bio-media';
// Tiny disposable PNG payload, not a user file.
const IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9YROsAAAAASUVORK5CYII=';

export function MediaSmokeTest() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    'ยังไม่ได้ทดสอบการอัปโหลด ดาวน์โหลด และลบรูปภาพจริง'
  );
  const [passed, setPassed] = useState(false);

  async function runTest() {
    if (running) return;
    setRunning(true);
    setPassed(false);
    let uploaded = false;
    let issue: string | null = null;
    const path = `phase1-tests/${crypto.randomUUID()}.png`;
    const client = createSupabaseBrowserClient();
    const binary = Uint8Array.from(atob(IMAGE_BASE64), c => c.charCodeAt(0));
    try {
      setMessage('กำลังอัปโหลดภาพทดสอบ...');
      const file = new Blob([binary.buffer as ArrayBuffer], { type: 'image/png' });
      const { error: uploadError } = await client.storage
        .from(BUCKET).upload(path, file, { contentType: 'image/png', upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;

      setMessage('กำลังดาวน์โหลดและตรวจสอบข้อมูล...');
      const { data, error: downloadError } = await client.storage
        .from(BUCKET).download(path);
      if (downloadError || !data) throw downloadError ?? Error('No downloaded file');
      const downloaded = new Uint8Array(await data.arrayBuffer());
      if (downloaded.length !== binary.length ||
          downloaded.some((value, index) => value !== binary[index])) {
        throw Error('Downloaded image contents did not match upload');
      }
    } catch (error) {
      issue = error instanceof Error ? error.message : 'Storage API test failed';
    } finally {
      if (uploaded) {
        setMessage('กำลังลบภาพทดสอบออกจาก Storage...');
        const { error: deleteError } = await client.storage.from(BUCKET).remove([path]);
        if (deleteError) {
          issue = `${issue ? issue + '; ' : ''}ลบภาพทดสอบไม่สำเร็จ: ${deleteError.message}`;
        }
      }
      setPassed(!issue);
      setMessage(issue
        ? `ทดสอบไม่ผ่าน: ${issue}`
        : 'ผ่าน: อัปโหลด ดาวน์โหลด ตรวจสอบข้อมูล และลบภาพทดสอบสำเร็จ');
      setRunning(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-5 space-y-3">
      <h2 className="text-xl font-semibold">ทดสอบรูปภาพ (Phase 1)</h2>
      <p className="text-sm text-slate-600">
        ทดสอบ Storage ส่วนตัวด้วยภาพชั่วคราวที่ระบบสร้างเอง
        อัปโหลด ดาวน์โหลด เปรียบเทียบข้อมูล แล้วลบออก
      </p>
      <button type="button" disabled={running} onClick={runTest}
        className="rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-50">
        {running ? 'กำลังทดสอบ...' : 'เริ่มทดสอบ Storage'}
      </button>
      <p role="status" aria-live="polite"
        className={passed ? 'text-sm text-green-700' : 'text-sm text-slate-700'}>
        {message}
      </p>
    </section>
  );
}
