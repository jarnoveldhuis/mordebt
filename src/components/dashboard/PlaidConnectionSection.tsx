import PlaidLink from "@/components/PlaidLink";

interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string) => void;
}

export function PlaidConnectionSection({ onSuccess }: PlaidConnectionSectionProps) {
  return (
    <div className="flex justify-center mb-6">
      <PlaidLink onSuccess={onSuccess} />
    </div>
  );
}