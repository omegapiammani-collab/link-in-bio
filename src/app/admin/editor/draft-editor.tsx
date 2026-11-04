'use client';

import { useEffect, useState } from 'react';
import { loadExistingDraft, saveExistingDraft, DraftRequestError } from '@/lib/domain/draft-api.mjs';
import { validExternalUrl } from '@/lib/domain/draft-contract.mjs';

type LinkDraft = { id: string; title: string; url: string; active: boolean };
const INITIAL_LINKS: LinkDraft[] = [{ id: 'd50ebcde-70cf-4e98-9efe-72e467975364', title: 'เว็บไซต์ของฉัน', url: 'https://example.com', active: true }];

function validateLink(url: string): string | null {
  return validExternalUrl(url)
    ? null
    : 'กรุณาใช้ URL http/https ของโดเมนสาธารณะที่ถูกต้อง (ไม่รองรับ IP หรือโดเมนภายใน)';
}

export function DraftEditor({ draftPageId }: { draftPageId?: string }) {
  const [name, setName] = useState('ชื่อโปรไฟล์ของฉัน');
  const [description, setDescription] = useState('ยินดีต้อนรับสู่หน้ารวมลิงก์');
  const [links, setLinks] = useState<LinkDraft[]>(INITIAL_LINKS);
  const [showPreview, setShowPreview] = useState(true);
  const [revision, setRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(draftPageId));
  const [saving, setSaving] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!draftPageId) return;
    const controller = new AbortController();
    void loadExistingDraft(fetch, draftPageId, controller.signal)
      .then(({ document, revision: loadedRevision }) => {
        if (controller.signal.aborted) return;
        setName(document.name);
        setDescription(document.description);
        setLinks(document.links);
        setRevision(loadedRevision);
        setDirty(false);
        setFeedback('');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFeedback(error instanceof DraftRequestError
          ? 'ไม่สามารถโหลดฉบับร่างได้ (' + error.code + ')' : 'การเชื่อมต่อไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [draftPageId]);

  async function save() {
    if (!draftPageId || revision === null || invalid || saving || conflicted) return;
    setSaving(true);
    setFeedback('');
    try {
      const result = await saveExistingDraft(fetch, draftPageId, revision, { name, description, links });
      setRevision(result.revision);
      setDirty(false);
      setFeedback('บันทึกฉบับร่างสำเร็จ (revision ' + result.revision + ')');
    } catch (error) {
      if (error instanceof DraftRequestError && error.status === 409) {
        setConflicted(true);
        setFeedback('มีการบันทึกฉบับร่างเวอร์ชันใหม่แล้ว โปรดตรวจสอบและโหลดข้อมูลล่าสุดก่อนบันทึก');
      } else {
        setFeedback('บันทึกไม่สำเร็จ ข้อมูลในหน้านี้ยังไม่ถูกส่งเผยแพร่');
      }
    } finally {
      setSaving(false);
    }
  }

  async function reloadLatest() {
    if (!draftPageId || saving || loading) return;
    if (dirty && !window.confirm('การโหลดข้อมูลล่าสุดจะทิ้งการแก้ไขที่ยังไม่ได้บันทึก ต้องการดำเนินการหรือไม่?')) return;
    setLoading(true);
    setFeedback('');
    try {
      const result = await loadExistingDraft(fetch, draftPageId);
      setName(result.document.name);
      setDescription(result.document.description);
      setLinks(result.document.links);
      setRevision(result.revision);
      setConflicted(false);
      setDirty(false);
      setFeedback('โหลดฉบับร่างล่าสุดแล้ว');
    } catch {
      setFeedback('ไม่สามารถโหลดฉบับร่างล่าสุดได้');
    } finally {
      setLoading(false);
    }
  }
  const linkErrors = links.map(link =>
    link.title.trim().length === 0 || link.title.length > 100
      ? 'ชื่อปุ่มต้องมี 1–100 ตัวอักษร'
      : validateLink(link.url)
  );
  const invalid = !name.trim() || name.length > 80 || description.length > 500 ||
    links.length > 20 || linkErrors.some(Boolean);

  function updateLink(id: string, patch: Partial<LinkDraft>) {
    setDirty(true);
    setLinks(previous => previous.map(link => link.id === id ? { ...link, ...patch } : link));
  }

  function move(id: string, direction: -1 | 1) {
    setDirty(true);
    setLinks(previous => {
      const index = previous.findIndex(link => link.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous;
      const updated = [...previous];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  }

  if (draftPageId && (loading || revision === null)) {
    return (
      <section className="rounded-xl border bg-white p-6" aria-live="polite">
        <p>{loading ? 'กำลังโหลดฉบับร่าง...' : feedback || 'ไม่พบฉบับร่างที่เปิดใช้งานได้'}</p>
        {!loading && <button type="button" className="mt-3 rounded border px-3 py-2"
          onClick={() => void reloadLatest()}>ลองโหลดอีกครั้ง</button>}
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">ข้อมูลโปรไฟล์</h2>
        <div className="space-y-2">
          <label htmlFor="profile-name" className="block text-sm font-medium">ชื่อโปรไฟล์</label>
          <input id="profile-name" className="w-full rounded-lg border p-3"
            maxLength={81} value={name} disabled={saving} onChange={e => { setName(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-description" className="block text-sm font-medium">คำอธิบาย</label>
          <textarea id="profile-description" className="min-h-24 w-full rounded-lg border p-3"
            maxLength={501} value={description} disabled={saving} onChange={e => { setDescription(e.target.value); setDirty(true); }} />
        </div>
        <h2 className="text-xl font-semibold">ปุ่มลิงก์</h2>
        {links.map((link, index) => (
          <div key={link.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">ลิงก์ที่ {index + 1}</span>
              <div className="flex gap-2">
                <button type="button" aria-label="เลื่อนขึ้น" disabled={saving || index === 0}
                  onClick={() => move(link.id, -1)} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
                <button type="button" aria-label="เลื่อนลง" disabled={saving || index === links.length - 1}
                  onClick={() => move(link.id, 1)} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
                <button type="button" disabled={saving} onClick={() => { setDirty(true); setLinks(current => current.filter(item => item.id !== link.id)); }}
                  className="rounded border px-2 py-1">ลบ</button>
              </div>
            </div>
            <label htmlFor={`link-title-${link.id}`} className="block text-sm">ชื่อปุ่ม</label>
            <input id={`link-title-${link.id}`} className="w-full rounded-lg border p-2"
              value={link.title} maxLength={101} disabled={saving}
              onChange={e => updateLink(link.id, { title: e.target.value })} />
            <label htmlFor={`link-url-${link.id}`} className="block text-sm">URL</label>
            <input id={`link-url-${link.id}`} className="w-full rounded-lg border p-2" type="url"
              value={link.url} maxLength={2049} disabled={saving}
              onChange={e => updateLink(link.id, { url: e.target.value })} />
            {linkErrors[index] && <p className="text-sm text-red-700" role="alert">{linkErrors[index]}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={saving} checked={link.active} onChange={e => updateLink(link.id, { active: e.target.checked })} />
              แสดงปุ่มในตัวอย่าง
            </label>
          </div>
        ))}
        <button type="button" disabled={saving || links.length >= 20}
          onClick={() => { setDirty(true); setLinks(current => [...current, {
            id: crypto.randomUUID(), title: '', url: 'https://', active: true,
          }]); }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
          เพิ่มลิงก์ (สูงสุด 20)
        </button>
        <div className="border-t pt-4 space-y-2">
          <p aria-live="polite" className="text-sm text-slate-600">
            {invalid ? 'กรุณาตรวจสอบชื่อโปรไฟล์ คำอธิบาย และ URL ก่อนใช้งาน' : 'รูปแบบข้อมูลตัวอย่างถูกต้อง'}
          </p>
          <p className="text-sm font-medium text-amber-800">
            {draftPageId
              ? 'โหมดทดสอบ: บันทึกได้เฉพาะฉบับร่างที่มีอยู่แล้ว การเผยแพร่ยังปิดอยู่'
              : 'โหมดตัวอย่าง: ไม่บันทึกข้อมูลและไม่เผยแพร่'}
          </p>
          {draftPageId && <p className="text-xs text-slate-600">Revision {revision} · {dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ไม่มีการเปลี่ยนแปลงที่รอบันทึก'}</p>}
          {feedback && <p role="status" aria-live="polite" className="text-sm text-slate-700">{feedback}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!draftPageId || invalid || saving || conflicted || !dirty}
              onClick={() => void save()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:bg-slate-200 disabled:text-slate-500">
              {saving ? 'กำลังบันทึก...' : draftPageId ? 'บันทึกฉบับร่าง' : 'บันทึกฉบับร่าง (ปิดใช้งาน)'}
            </button>
            {draftPageId && <button type="button" disabled={saving}
              onClick={() => void reloadLatest()}
              className="rounded-lg border px-4 py-2 disabled:opacity-50">
              โหลดข้อมูลล่าสุด
            </button>}
          </div>
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
