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

  // Prepare sorted practices for the table rows
  const sortedPractices = Object.entries(practiceDonations)
    .sort(([, a], [, b]) => Math.abs(b.amount) - Math.abs(a.amount));
  
  const debtColorClass = totalSocietalDebt > 0 ? "text-red-500" : "text-green-500";

  // Helper function to find information for a practice
  const findPracticeInfo = (practice: string): string => {
    // Check all transactions for information about this practice
    for (const tx of transactions) {
      if (tx.information && tx.information[practice]) {
        return tx.information[practice];
      }
    }
    return "No details available";
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Ethical Impact Summary
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left text-gray-700 p-2">Practice</th>
              <th className="text-left text-gray-700 p-2">Charity</th>
              <th className="text-left text-gray-700 p-2">Impact</th>
              <th className="text-right text-gray-700 p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedPractices.map(([practice, { charity, amount }], i) => {
              const practiceInfo = findPracticeInfo(practice);
              const amountColorClass = amount >= 0 ? "text-red-600" : "text-green-600";
              
              return (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
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
                  <td className="p-2 text-gray-700 italic">
                    {practiceInfo || "No information available"}
                  </td>
                  <td className={`p-2 text-right font-bold ${amountColorClass}`}>
                    ${Math.abs(amount).toFixed(2)}
                  </td>
                </tr>
              );
            })}

            {/* Total Debt Row */}
            <tr className="border-t-2 border-gray-300 font-bold">
              <td colSpan={2} className="p-2">
                <a 
                  href={selectedCharity || "https://www.charitynavigator.org"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow inline-block"
                >
                  💳 Offset Impact
                </a>
              </td>
              <td className="p-2 text-right text-black">Total Impact:</td>
              <td className={`p-2 text-right text-xl ${debtColorClass}`}>
                ${Math.abs(totalSocietalDebt).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}