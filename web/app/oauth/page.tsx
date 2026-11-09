import { Suspense } from 'react';
import type { Metadata } from 'next';
import OAuthTester from '@/components/oauth/OAuthTester';

export const metadata: Metadata = { title: 'OAuth tester | Programmable Banking Sandbox' };

export default function OAuthPage() {
  return (
    <Suspense>
      <OAuthTester />
    </Suspense>
  );
}
