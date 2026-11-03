import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Link-in-Bio | เริ่มต้นโครงการ', description: 'Single-user link-in-bio app foundation' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="th"><body>{children}</body></html>;
}
