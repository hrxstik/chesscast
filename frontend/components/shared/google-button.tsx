import Link from 'next/link';
import React from 'react';
import { getApiUrl } from '@/lib/utils';

interface Props {
  className?: string;
}

export const GoogleButton: React.FC<Props> = ({ className }) => {
  return (
    <>
      <Link
        href={`${getApiUrl()}/auth/google`}
        className="w-full block text-center mt-3 py-2 border border-gray-400 rounded hover:bg-gray-100 dark:hover:bg-neutral-800">
        Войти через Google
      </Link>
    </>
  );
};
