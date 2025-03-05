// src/components/PlaidLink.tsx

'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (public_token: string) => void;
        onExit: (error?: PlaidError) => void;
      }) => { open: () => void };
    };
  }
}

interface PlaidError {
  error_code: string;
  error_message: string;
  display_message: string | null;
}

interface PlaidLinkProps {
  onSuccess: (public_token: string) => void;
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const response = await fetch('/api/plaid/create_link_token', { method: 'GET' }); // ✅ Explicit GET request
        const data = await response.json();
        console.log('Generated Plaid Link Token:', data.link_token);
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('❌ Error fetching Plaid link token:', error);
      }
    }
    fetchLinkToken();
  }, []);
  

  function openPlaidLink() {
    if (!linkToken) return;

    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: (public_token: string) => {
        console.log('✅ Plaid Success! public_token:', public_token);
        onSuccess(public_token);
      },
      onExit: (error?: PlaidError) => {
        if (error) console.error('❌ Plaid Link Exit Error:', error);
      },
    });

    handler.open();
  }

  return (
    <button
      onClick={openPlaidLink}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200"
      disabled={!linkToken}
    >
      Connect Bank Account
    </button>
  );
}
