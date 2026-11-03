import Link from 'next/link';
export default function Home() {
 return <main className="mx-auto max-w-2xl px-6 py-20 space-y-5">
  <p className="text-sm uppercase tracking-widest text-slate-500">Phase 1 · Foundation</p>
  <h1 className="text-3xl font-bold">Link-in-Bio ภาษาไทย–อังกฤษ</h1>
  <p className="text-slate-600">โครงสร้างเริ่มต้นของระบบสำหรับ Owner หนึ่งคน ยังไม่มีหน้าโปรไฟล์หรือระบบเผยแพร่จริง</p>
  <Link href="/login">เข้าสู่ระบบผู้ดูแล</Link>
 </main>;
}
