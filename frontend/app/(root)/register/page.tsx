import { RegisterForm } from '@/components/shared/form/register-form';
import { RedirectIfAuthed } from '@/components/layout/redirect-if-authed';
import React, { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <RedirectIfAuthed>
      <div className="flex flex-1 flex-col justify-center px-4 py-10 md:py-16">
        <Suspense fallback={<div className="text-muted-foreground">Загрузка…</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </RedirectIfAuthed>
  );
}
