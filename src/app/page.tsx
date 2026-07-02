'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuth();

  
 
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated) router.replace(user ? '/dashboard' : '/login');
  }, [hydrated, user, router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--fg-3)' }}>
      Yuklanmoqda...
    </div>
  );
}