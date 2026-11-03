import { redirect } from 'next/navigation';
import { getOwner } from '@/lib/auth/owner';
import { SignOutButton } from './sign-out-button';
import { MediaSmokeTest } from './media-smoke-test';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 const owner=await getOwner();
 if(!owner) redirect('/login');
 return <main className="mx-auto max-w-2xl px-6 py-20 space-y-5">
  <p className="text-sm text-slate-500">Foundation · Owner-only</p>
  <h1 className="text-3xl font-bold">แผงควบคุม</h1>
  <p>บัญชี Owner ได้รับการยืนยันแล้ว</p>
  <p className="text-sm text-slate-500">การสร้างหน้า การแก้ไขและเผยแพร่จะพัฒนาใน Phase ถัดไป</p>
  <MediaSmokeTest/>
  <SignOutButton/>
 </main>;
}
