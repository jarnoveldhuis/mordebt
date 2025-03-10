import { Transaction } from "@/types/transactions";

interface TransactionListProps {
  transactions: Transaction[];
  getColorClass: (value: number) => string;
}

export function TransactionList({ transactions, getColorClass }: TransactionListProps) {
  if (transactions.length === 0) return null;
  
  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Your Transactions
      </h2>
      <ul className="space-y-2 max-h-60 overflow-y-auto">
        {transactions.map((t, i) => {
          const allBadges = [
            ...(t.unethicalPractices || []).map((practice) => ({
              text: `${practice} (${t.practiceWeights?.[practice]}%)`,
              type: "unethical",
            })),
            ...(t.ethicalPractices || []).map((practice) => ({
              text: `${practice} (${t.practiceWeights?.[practice]}%)`,
              type: "ethical",
            })),
          ];

          return (
            <li key={i} className="bg-white p-3 rounded-lg shadow-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">
                  {t.date} - {t.name} - ${t.amount.toFixed(2)}
                </span>
                <span
                  className={`font-semibold ${getColorClass(
                    t.societalDebt || 0
                  )}`}
                >
                  ${(t.societalDebt || 0).toFixed(2)}
                </span>
              </div>

              {allBadges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {allBadges.map((badge, idx) => {
                    const bgColor =
                      badge.type === "unethical"
                        ? "bg-red-200 text-red-700"
                        : "bg-green-200 text-green-700";
                    return (
                      <span
                        key={idx}
                        className={`${bgColor} text-xs px-2 py-1 rounded-lg`}
                      >
                        {badge.text}
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}