import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kantor AI — Monitoring Agent Agency',
  description: 'Webapp monitoring/orchestration 3D untuk 267 agent AI dalam 18 divisi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
