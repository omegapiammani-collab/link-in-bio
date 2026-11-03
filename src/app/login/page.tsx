import { LoginButton } from './sign-in-button';

type LoginQuery = { error?: string | string[]; error_code?: string | string[] };

export default async function LoginPage({
 searchParams,
}: {
 searchParams: Promise<LoginQuery>;
}) {
 const params = await searchParams;
 const error = typeof params.error === 'string' ? params.error : '';
 const errorCode = typeof params.error_code === 'string' ? params.error_code : '';
 const oauthProviderFailure = error === 'server_error' && errorCode === 'unexpected_failure';
 const message = oauthProviderFailure
  ? 'Google ส่งกลับมาแล้ว แต่ระบบยืนยันตัวตนยังไม่สำเร็จ กรุณาลองใหม่ภายหลัง หากเกิดซ้ำให้ผู้ดูแลตรวจ Supabase Auth Logs'
  : error === 'unauthorized'
   ? 'บัญชี Google นี้ไม่ได้รับสิทธิ์ Owner จึงไม่สามารถเข้าสู่แผงควบคุมได้'
   : error
    ? 'การเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    : '';

 return <main className="mx-auto max-w-lg px-6 py-24 space-y-6">
  <h1 className="text-2xl font-bold">เข้าสู่ระบบ Owner</h1>
  <p className="text-slate-600">รองรับบัญชี Google ที่กำหนดเป็น Owner เพียงหนึ่งบัญชีเท่านั้น</p>
  {message && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{message}</p>}
  <LoginButton />
 </main>;
}
