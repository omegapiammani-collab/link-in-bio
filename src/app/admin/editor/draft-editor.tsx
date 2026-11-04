'use client';

import { useState } from 'react';

type LinkDraft = { id: string; title: string; url: string; active: boolean };
const INITIAL_LINKS: LinkDraft[] = [{ id: 'sample-1', title: 'เว็บไซต์ของฉัน', url: 'https://example.com', active: true }];

function validateLink(url: string): string | null {
  const value = url.trim();
  if (!value || value.length > 2048) return 'กรุณากรอก URL ที่มีความยาวไม่เกิน 2,048 ตัวอักษร';
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol)) return 'รองรับเฉพาะลิงก์ http และ https';
    if (parsed.username || parsed.password) return 'URL ต้องไม่มีข้อมูลเข้าสู่ระบบ';
    if (!parsed.hostname.includes('.')) return 'กรุณากรอกชื่อโดเมนที่ถูกต้อง';
    return null;
  } catch {
    return 'รูปแบบ URL ไม่ถูกต้อง';
  }
}

export function DraftEditor() {
  const [name, setName] = useState('ชื่อโปรไฟล์ของฉัน');
  const [description, setDescription] = useState('ยินดีต้อนรับสู่หน้ารวมลิงก์');
  const [links, setLinks] = useState<LinkDraft[]>(INITIAL_LINKS);
  const [showPreview, setShowPreview] = useState(true);
  const linkErrors = links.map(link =>
    link.title.trim().length === 0 || link.title.length > 100
      ? 'ชื่อปุ่มต้องมี 1–100 ตัวอักษร'
      : validateLink(link.url)
  );
  const invalid = !name.trim() || name.length > 80 || description.length > 500 ||
    links.length > 20 || linkErrors.some(Boolean);

  function updateLink(id: string, patch: Partial<LinkDraft>) {
    setLinks(previous => previous.map(link => link.id === id ? { ...link, ...patch } : link));
  }

  function move(id: string, direction: -1 | 1) {
    setLinks(previous => {
      const index = previous.findIndex(link => link.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous;
      const updated = [...previous];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">ข้อมูลโปรไฟล์</h2>
        <div className="space-y-2">
          <label htmlFor="profile-name" className="block text-sm font-medium">ชื่อโปรไฟล์</label>
          <input id="profile-name" className="w-full rounded-lg border p-3"
            maxLength={81} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-description" className="block text-sm font-medium">คำอธิบาย</label>
          <textarea id="profile-description" className="min-h-24 w-full rounded-lg border p-3"
            maxLength={501} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <h2 className="text-xl font-semibold">ปุ่มลิงก์</h2>
        {links.map((link, index) => (
          <div key={link.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">ลิงก์ที่ {index + 1}</span>
              <div className="flex gap-2">
                <button type="button" aria-label="เลื่อนขึ้น" disabled={index === 0}
                  onClick={() => move(link.id, -1)} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
                <button type="button" aria-label="เลื่อนลง" disabled={index === links.length - 1}
                  onClick={() => move(link.id, 1)} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
                <button type="button" onClick={() => setLinks(current => current.filter(item => item.id !== link.id))}
                  className="rounded border px-2 py-1">ลบ</button>
              </div>
            </div>
            <label htmlFor={`link-title-${link.id}`} className="block text-sm">ชื่อปุ่ม</label>
            <input id={`link-title-${link.id}`} className="w-full rounded-lg border p-2"
              value={link.title} maxLength={101}
              onChange={e => updateLink(link.id, { title: e.target.value })} />
            <label htmlFor={`link-url-${link.id}`} className="block text-sm">URL</label>
            <input id={`link-url-${link.id}`} className="w-full rounded-lg border p-2" type="url"
              value={link.url} maxLength={2049}
              onChange={e => updateLink(link.id, { url: e.target.value })} />
            {linkErrors[index] && <p className="text-sm text-red-700" role="alert">{linkErrors[index]}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={link.active} onChange={e => updateLink(link.id, { active: e.target.checked })} />
              แสดงปุ่มในตัวอย่าง
            </label>
          </div>
        ))}
        <button type="button" disabled={links.length >= 20}
          onClick={() => setLinks(current => [...current, {
            id: crypto.randomUUID(), title: '', url: 'https://', active: true,
          }])}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
          เพิ่มลิงก์ (สูงสุด 20)
        </button>
        <div className="border-t pt-4 space-y-2">
          <p aria-live="polite" className="text-sm text-slate-600">
            {invalid ? 'กรุณาตรวจสอบชื่อโปรไฟล์ คำอธิบาย และ URL ก่อนใช้งาน' : 'รูปแบบข้อมูลตัวอย่างถูกต้อง'}
          </p>
          <p className="text-sm font-medium text-amber-800">
            ยังไม่เปิดการบันทึกหรือเผยแพร่ เพื่อป้องกันการเปลี่ยนข้อมูล Production
          </p>
          <button type="button" disabled className="rounded-lg bg-slate-200 px-4 py-2 text-slate-500">
            บันทึกฉบับร่าง (ยังไม่พร้อมใช้งาน)
          </button>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">ตัวอย่างหน้าโปรไฟล์</h2>
          <button type="button" onClick={() => setShowPreview(value => !value)}
            className="rounded border px-3 py-2 text-sm">
            {showPreview ? 'ซ่อนตัวอย่าง' : 'แสดงตัวอย่าง'}
          </button>
        </div>
        {showPreview && (
          <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
            <div aria-hidden="true" className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-2xl">
              ◯
            </div>
            <h3 className="break-words text-2xl font-bold">{name.trim() || 'ชื่อโปรไฟล์'}</h3>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">{description}</p>
            <div className="mt-8 space-y-3">
              {links.filter(link => link.active && link.title.trim() && !validateLink(link.url)).map(link => (
                <div key={link.id} className="break-words rounded-xl border bg-slate-50 p-4 font-medium">
                  {link.title}
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs text-slate-400">ตัวอย่างเท่านั้น · ไม่ใช่หน้าเผยแพร่จริง · ปุ่มลิงก์ไม่เปิด URL</p>
          </div>
        )}
      </section>
    </div>
  );
}
