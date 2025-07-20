'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import HubCreationForm from '@/components/legacy-hub/HubCreationForm';
import PageShell from '@/components/PageShell';

export default function CreateHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?redirect=/hubs/create');
          return;
        }
        setUser(session.user);
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-center mt-4">Loading...</p>
        </main>
      </PageShell>
    );
  }

  if (!user) {
    return null; // Router will redirect, no need to render anything
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/hubs" className="text-blue-600 hover:underline">
            &larr; Back to Hubs
          </Link>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <HubCreationForm />
        </div>
      </main>
    </PageShell>
  );
}