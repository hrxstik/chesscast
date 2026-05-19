import { LoginForm } from '@/components/shared/form/login-form';
import { RedirectIfAuthed } from '@/components/layout/redirect-if-authed';
import React, { Suspense } from 'react';

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 md:py-16">
        <Suspense fallback={<div className="text-muted-foreground">Загрузка…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </RedirectIfAuthed>
  );
}
