'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageShell from '@/components/PageShell';

interface InvitationDetails {
  valid: boolean;
  hubId: string;
  hubName: string;
  expired: boolean;
  used: boolean;
}

export default function InvitationPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { token } = params;
  
  const [user, setUser] = useState<any>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkInvitation = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if invitation is valid
        const response = await fetch(`/api/invitations/${token}/validate`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Invalid invitation');
        }
        
        const data = await response.json();
        
        if (!data.valid) {
          throw new Error('Invalid invitation');
        }
        
        setInvitation({
          valid: true,
          hubId: data.hub.id,
          hubName: data.hub.name,
          expired: false,
          used: false
        });

        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (err) {
        console.error('Error checking invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    };

    checkInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    try {
      setAccepting(true);
      setError(null);

      // Accept invitation
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      const data = await response.json();
      setSuccess(true);
      
      // Redirect to hub after a short delay
      setTimeout(() => {
        router.push(`/hubs/${data.hubId}`);
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-center mt-4">Validating invitation...</p>
        </main>
      </PageShell>
    );
  }

  if (error || !invitation || !invitation.valid) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto p-6 bg-white rounded shadow-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Invitation</h1>
            <p className="text-gray-700 mb-4">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <Link href="/" className="text-blue-600 hover:underline">
              Return to Home
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  if (invitation.expired) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto p-6 bg-white rounded shadow-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invitation Expired</h1>
            <p className="text-gray-700 mb-4">
              This invitation link has expired. Please request a new invitation.
            </p>
            <Link href="/" className="text-blue-600 hover:underline">
              Return to Home
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  if (invitation.used) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto p-6 bg-white rounded shadow-md">
            <h1 className="text-2xl font-bold text-yellow-600 mb-4">Invitation Already Used</h1>
            <p className="text-gray-700 mb-4">
              This invitation has already been used. If you've already accepted it, you can access the hub directly.
            </p>
            <Link href={`/hubs/${invitation.hubId}`} className="text-blue-600 hover:underline">
              Go to Hub
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto p-6 bg-white rounded shadow-md">
          <h1 className="text-2xl font-bold text-green-600 mb-4">Invitation to Legacy Hub</h1>
          
          <p className="text-gray-700 mb-6">
            You've been invited to join the Legacy Hub: <strong>{invitation.hubName}</strong>
          </p>
          
          {success ? (
            <div className="success-message p-4 bg-green-100 text-green-700 rounded mb-4">
              <p>Invitation accepted successfully! Redirecting to hub...</p>
            </div>
          ) : error ? (
            <div className="error-message p-4 bg-red-100 text-red-700 rounded mb-4">
              <p>{error}</p>
            </div>
          ) : null}
          
          {!user ? (
            <div className="auth-required mb-6">
              <p className="text-gray-700 mb-4">
                Please sign in or create an account to accept this invitation.
              </p>
              <div className="flex space-x-4">
                <Link
                  href={`/login?redirect=/invite/${token}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Sign In
                </Link>
                <Link
                  href={`/signup?redirect=/invite/${token}`}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <div className="accept-invitation">
              <button
                onClick={handleAcceptInvitation}
                disabled={accepting || success}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}