// src/app/api/banking/PlaidConnectionSection.tsx

import PlaidLink from "@/features/banking/PlaidLink";

interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string | null) => void;
}

export function PlaidConnectionSection({ onSuccess }: PlaidConnectionSectionProps) {
  return (
    <div className="flex justify-center mb-6">
      <PlaidLink onSuccess={onSuccess} />
    </div>
  );
}