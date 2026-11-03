import { LoginButton } from './sign-in-button';
export default function LoginPage() {
 return <main className="mx-auto max-w-lg px-6 py-24 space-y-6">
  <h1 className="text-2xl font-bold">เข้าสู่ระบบ Owner</h1>
  <p className="text-slate-600">รองรับบัญชี Google ที่กำหนดเป็น Owner เพียงหนึ่งบัญชีเท่านั้น</p>
  <LoginButton />
 </main>;
}
