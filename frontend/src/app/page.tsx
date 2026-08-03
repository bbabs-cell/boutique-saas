'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-light dark:bg-canvas-dark">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}
