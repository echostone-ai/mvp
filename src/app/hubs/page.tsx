'use client';

import React from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function HubsPage() {
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

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Your Hubs</h2>
          <div className="empty-state p-8 text-center border rounded bg-gray-50">
            <p className="text-gray-600">
              This page is under development. Please check back later.
            </p>
          </div>
        </section>
      </main>
    </PageShell>
  );
}