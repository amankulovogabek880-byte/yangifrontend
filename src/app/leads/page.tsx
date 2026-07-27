'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// v29: Bu sahifa "/clients" bilan deyarli AYNAN bir xil edi (bir xil
// ma'lumot, bir xil filtrlar) — ikkita nom bilan bitta narsani ko'rsatib,
// chalkashtirardi. Hech qayerdan menyu orqali link qilinmagan (o'lik
// sahifa) edi. Endi yagona "Mijozlar" sahifasiga yo'naltiradi.
export default function LeadsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/clients'); }, []);
  return null;
}