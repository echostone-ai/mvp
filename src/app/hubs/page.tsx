'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PageShell from '@/components/PageShell';

interface Hub {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  ownerId: string;
  _count?: {
    memories: number;
    viewers: number;
  };
}

export default function HubsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ownedHubs, setOwnedHubs] = useState<Hub[]>([]);
  const [viewableHubs, setViewableHubs] = useState<Hub[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login?redirect=/hubs');
          return;
        }
        setUser(session.user);
        await loadHubs(session.user.id);
      } catch (err) {
        console.error('Auth error:', err);
        setError('Authentication failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadHubs = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all hubs (API will return both owned and viewable hubs)
      const response = await fetch('/api/hubs');
      
      if (!response.ok) {
        throw new Error('Failed to load hubs');
      }
      
      const data = await response.json();
      
      // Separate owned and viewable hubs
      const owned: Hub[] = [];
      const viewable: Hub[] = [];
      
      data.hubs.forEach((hub: any) => {
        if (hub.ownerId === userId) {
          owned.push(hub);
        } else if (hub.accessLevel) {
          viewable.push(hub);
        }
      });
      
      setOwnedHubs(owned);
      setViewableHubs(viewable);
    } catch (err) {
      console.error('Error loading hubs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hubs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-center mt-4">Loading your hubs...</p>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Legacy Hubs</h1>
          <Link
            href="/hubs/create"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create New Hub
          </Link>
        </div>

        {error && (
          <div className="error-message mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Your Hubs</h2>
          {ownedHubs.length === 0 ? (
            <div className="empty-state p-8 text-center border rounded bg-gray-50">
              <p className="text-gray-600">
                You haven't created any hubs yet. Create your first hub to start preserving memories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedHubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/hubs/${hub.id}`}
                  className="hub-card block p-6 border rounded hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-medium">{hub.name}</h3>
                    <span className={`status-badge px-2 py-1 text-xs rounded ${
                      hub.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {hub.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2 line-clamp-2">
                    {hub.description || 'No description provided'}
                  </p>
                  <div className="hub-stats flex mt-4 text-sm text-gray-500">
                    <div className="mr-4">
                      <span className="font-medium">{hub._count?.memories || 0}</span> memories
                    </div>
                    <div>
                      <span className="font-medium">{hub._count?.viewers || 0}</span> viewers
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Shared With You</h2>
          {viewableHubs.length === 0 ? (
            <div className="empty-state p-8 text-center border rounded bg-gray-50">
              <p className="text-gray-600">
                No hubs have been shared with you yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {viewableHubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/hubs/${hub.id}`}
                  className="hub-card block p-6 border rounded hover:shadow-md transition-shadow"
                >
                  <h3 className="text-xl font-medium">{hub.name}</h3>
                  <p className="text-gray-600 mt-2 line-clamp-2">
                    {hub.description || 'No description provided'}
                  </p>
                  <div className="hub-stats mt-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">{hub._count?.memories || 0}</span> memories
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </PageShell>
  );
}