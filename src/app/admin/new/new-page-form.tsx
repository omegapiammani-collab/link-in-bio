'use client';

import { useState } from 'react';
import { createNewDraftPage, DraftRequestError } from '@/lib/domain/draft-api.mjs';

export function NewPageForm() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const slugValid = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) &&
    slug.length <= 64 && !new Set(['admin', 'auth', 'api', 'login', 'en', '_next']).has(slug);
  const valid = slugValid && Boolean(name.trim()) && name.length <= 80 &&
    description.length <= 500;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setFeedback('');
    try {
      const result = await createNewDraftPage(fetch, slug, { name, description, links: [] });
      // The new page is still a private draft; navigate only to its Owner editor.
      window.location.assign('/admin/editor?pageId=' + encodeURIComponent(result.pageId));
    } catch (error) {
      if (error instanceof DraftRequestError && error.code === 'slug_conflict') {
        setFeedback('ชื่อนี้ถูกใช้แล้ว กรุณาเลือกชื่อ URL ใหม่');
      } else if (error instanceof DraftRequestError && error.code === 'unavailable') {
        setFeedback('การสร้างหน้ายังไม่เปิดใช้งานในสภาพแวดล้อมนี้');
      } else {
        setFeedback('สร้างหน้าฉบับร่างไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-5 rounded-xl border bg-white p-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="draft-slug">ชื่อ URL (slug)</label>
        <input id="draft-slug" required type="text" autoComplete="off"
          maxLength={64} value={slug} disabled={submitting}
          onChange={event => setSlug(event.target.value)}
          className="w-full rounded-lg border p-3" placeholder="my-page" />
        <p className="text-xs text-slate-500">ใช้ a–z, 0–9 และเครื่องหมายขีดกลางเท่านั้น</p>
        {slug && !slugValid && <p role="alert" className="text-sm text-red-700">รูปแบบ URL ไม่ถูกต้องหรือเป็นชื่อที่สงวนไว้</p>}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="draft-name">ชื่อโปรไฟล์</label>
        <input id="draft-name" required maxLength={80} value={name} disabled={submitting}
          onChange={event => setName(event.target.value)}
          className="w-full rounded-lg border p-3" placeholder="ชื่อหน้าโปรไฟล์" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="draft-description">คำอธิบาย</label>
        <textarea id="draft-description" maxLength={500} value={description} disabled={submitting}
          onChange={event => setDescription(event.target.value)}
          className="w-full rounded-lg border p-3" rows={3} />
      </div>
      {feedback && <p role="status" aria-live="polite" className="text-sm text-red-700">{feedback}</p>}
      <button type="submit" disabled={!valid || submitting}
        className="rounded-lg bg-slate-900 px-4 py-3 text-white disabled:bg-slate-200 disabled:text-slate-500">
        {submitting ? 'กำลังสร้างฉบับร่าง...' : 'สร้างฉบับร่าง (ยังไม่เผยแพร่)'}
      </button>
    </form>
  );
}
