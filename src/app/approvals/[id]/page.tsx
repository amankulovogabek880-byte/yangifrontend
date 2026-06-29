'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// /approvals/[id] → /approvals?id=xxx ga redirect qilamiz
// Approvals list sahifasida id bo'yicha modal ochiladi
export default function ApprovalDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/approvals?highlight=${id}`);
    } else {
      router.replace('/approvals');
    }
  }, [id, router]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
    }}>
      <span className="spinner spinner-lg" />
    </div>
  );
}
