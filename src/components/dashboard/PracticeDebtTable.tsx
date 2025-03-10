import { Transaction, Charity } from "@/types/transactions";
import React from "react";

interface PracticeDebtTableProps {
  practiceDonations: Record<string, { charity: Charity | null; amount: number }>;
  transactions: Transaction[];
  totalSocietalDebt: number | null;
  selectedCharity: string | null;
}

export function PracticeDebtTable({
  practiceDonations,
  transactions,
  totalSocietalDebt,
  selectedCharity,
}: PracticeDebtTableProps) {
  // Early return if no data
  if (totalSocietalDebt === null || Object.keys(practiceDonations).length === 0) {
    return null;
  }

  // Prepare data outside JSX
  const sortedPractices = Object.entries(practiceDonations)
    .sort(([, a], [, b]) => b.amount - a.amount);
  
  const debtColorClass = totalSocietalDebt > 0 ? "text-red-500" : "text-green-500";

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left text-gray-700 p-2">Practice</th>
            <th className="text-left text-gray-700 p-2">Charity</th>
            <th className="text-left text-gray-700 p-2">Information</th>
            <th className="text-right text-gray-700 p-2">Debt</th>
          </tr>
        </thead>
        <tbody>
          {sortedPractices.map(([practice, { charity, amount }], i) => {
            // Find matching transaction to get the 'information' field
            const transaction = transactions.find(
              (tx) => tx.practiceDebts && practice in tx.practiceDebts
            );
            
            const amountColorClass = amount >= 0 ? "text-red-600" : "text-green-600";
            
            return (
              <tr key={i} className="border-b border-gray-200">
                <td className={`p-2 font-medium ${amountColorClass}`}>
                  {practice}
                </td>
                <td className="p-2">
                  {charity ? (
                    <a 
                      href={charity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {charity.name}
                    </a>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="p-2">
                  {transaction && transaction.information ? (
                    <span className="text-gray-700">
                      {transaction.information}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      No info available
                    </span>
                  )}
                </td>
                <td className={`p-2 text-right font-bold ${amountColorClass}`}>
                  ${amount.toFixed(2)}
                </td>
              </tr>
            );
          })}

          {/* Total Debt Row */}
          <tr className="border-t border-gray-300">
            <td colSpan={3} className="p-2 text-right font-semibold">
              <a 
                href={selectedCharity || "https://www.charitynavigator.org"}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow"
              >
                💳 Offset Impact
              </a>
            </td>
            <td className="p-2 text-right font-bold">
              <div>
                <span className="text-lg font-semibold text-gray-800 block">
                  Total Debt:
                </span>
                <span className={`text-2xl font-bold ${debtColorClass}`}>
                  ${totalSocietalDebt.toFixed(2)}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}