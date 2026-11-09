'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';
import AuthCard from '@/components/AuthCard';
import { Button, Field, Input } from '@/components/ui';
import { loginActionUrl } from '@/lib/api/sandbox';

// The simulated bank sign-in step of the 3-legged OAuth flow. The form posts
// to the sandbox API, which redirects on to the consent page.
function LoginForm() {
  const params = useSearchParams();
  const qsp = params.get('qsp') ?? '';
  const failed = params.get('error') === 'invalid_credentials';

  return (
    <AuthCard
      title="Sign in to your account"
      footer="This is a simulated sign-in step. The sandbox user is admin@example.com with password admin."
    >
      <form className="space-y-5" action={loginActionUrl()} method="POST">
        <input type="hidden" name="qsp" value={qsp} />
        {failed && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Incorrect email or password.
          </p>
        )}
        <Field label="Email address" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue="admin@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" defaultValue="admin" required />
        </Field>
        <Button type="submit" className="w-full">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
