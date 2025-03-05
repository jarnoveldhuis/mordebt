// src/app/dashboard/page.tsx

"use client"; // Required for client-side interactivity

import { useState, useEffect, useCallback, useRef } from "react";
import PlaidLink from "@/components/PlaidLink";

export default function Dashboard() {
  interface Transaction {
    date: string;
    name: string;
    amount: number;
    ethics: string;
    ethicsScore: number;
    societalDebt: number;
    unethicalPractices: string[];
    ethicalPractices: string[];
    charities: Record<string, { name: string; url: string }>; // ✅ Supports multiple charities
    unethicalSavings?: number;
  }

  interface Charity {
    name: string;
    url: string;
  }

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number | null>(
    null
  );
  const [practiceDonations, setPracticeDonations] = useState<
    Record<string, { charity: Charity; amount: number }>
  >({});

  const [spendingSummary, setSpendingSummary] = useState<string>("");
  const [spendingType, setSpendingType] = useState<string | null>(null);
  const [debtPercentage, setDebtPercentage] = useState<number | null>(null);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [bankConnected, setBankConnected] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);

  const getColorClass = (value: number) => {
    console.log("Checking value:", value); // ✅ Debugging Log
    if (value < 0) return "text-green-500"; // 🌱 Green for neutral or positive impact
    if (value == 0) return "text-blue-500"; //  Yellow for slightly bad
    if (value <= 10) return "text-yellow-500"; // 🟡 Yellow for slightly bad
    if (value <= 20) return "text-orange-500"; // 🟠 Orange for moderately bad
    if (value <= 50) return "text-red-500"; // 🔴 Red for bad spending
    return "text-red-700"; // 🔥 Dark Red for very bad spending
  };

  async function handlePlaidSuccess(public_token: string) {
    try {
      setBankConnected(true);
      setLoadingTransactions(true);

      const response = await fetch("/api/plaid/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });

      const data = await response.json();
      if (data.access_token) {
        fetchTransactions(data.access_token);
      }
    } catch (error) {
      console.error("❌ Error in handlePlaidSuccess:", error);
    }
  }

  async function fetchTransactions(token: string) {
    try {
      const response = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });

      const data: Transaction[] = await response.json();

      if (data.length > 0) {
        const updatedTransactions = data.map((t) => ({
          ...t,
          societalDebt: 0,
          unethicalPractices: t.unethicalPractices || [],
          ethicalPractices: t.ethicalPractices || [],
        }));

        setTransactions(updatedTransactions);
        setAnalysisCompleted(false);
      } else {
        console.warn("⚠️ No transactions found.");
      }
    } catch (error) {
      console.error("❌ Error in fetchTransactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  }

  const handleAnalyze = useCallback(
    async (transactionsToAnalyze: Transaction[] = transactions) => {
      if (analysisCompleted || transactionsToAnalyze.length === 0) return;

      setAnalyzing(true);
      setTotalSocietalDebt(null);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsToAnalyze }),
        });

        const data = await response.json();
        if (data.transactions) {
          const sortedTransactions = data.transactions
            .map((t) => ({
              ...t,
              unethicalPractices: t.unethicalPractices || [],
              // ethicalPractices: t.ethicalPractices || [],
              charities: t.charities || {}, // ✅ Single charities object
            }))
            .sort((a, b) => b.ethicsScore - a.ethicsScore);

          setTransactions(sortedTransactions);

          let totalDebt = 0;
          const practiceDonations: Record<
            string,
            { charity?: Charity; amount: number }
          > = {};

          data.transactions.forEach((t: Transaction) => {
            totalDebt += t.societalDebt;

            // ✅ Assign donations for all practices
            const allPractices = [
              ...t.unethicalPractices,
              ...t.ethicalPractices,
            ];
            const perPracticeAmount =
              t.societalDebt / (allPractices.length || 1);

            allPractices.forEach((practice) => {
              const assignedCharity = t.charities?.[practice] || null;

              if (!practiceDonations[practice]) {
                practiceDonations[practice] = {
                  charity: assignedCharity, // Can be null
                  amount: 0,
                };
              }
              practiceDonations[practice].amount += perPracticeAmount;
            });
          });

          setDebtPercentage(data.debtPercentage);
          setTotalSocietalDebt(totalDebt);
          setSpendingSummary(data.summary);
          setSpendingType(data.spendingType);
          setPracticeDonations(practiceDonations);
          setAnalysisCompleted(true);
        }
      } catch (error) {
        console.error("❌ Error in handleAnalyze:", error);
      }

      setAnalyzing(false);
    },
    [transactions, analysisCompleted]
  );

  const isAnalyzing = useRef(false);

  useEffect(() => {
    if (transactions.length > 0 && !analysisCompleted && !isAnalyzing.current) {
      isAnalyzing.current = true;
      handleAnalyze();
    }
  }, [transactions, analysisCompleted, handleAnalyze]);

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Societal Debt Calculator
        </h1>

        {/* Hide "Connect Bank" if connected */}
        {!bankConnected && (
          <div className="flex justify-center mb-6">
            <PlaidLink onSuccess={handlePlaidSuccess} />
          </div>
        )}

        {/* 🔥 Show Spinner While Fetching Transactions */}
        {bankConnected && loadingTransactions && (
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
            <span className="ml-2 text-gray-700">Loading transactions...</span>
          </div>
        )}
        <div className="text-center text-lg font-semibold mb-4">
          {analyzing ? (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
              <span className="ml-2 text-gray-700">
                Calculating your societal debt...
              </span>
            </div>
          ) : (
            <>
              {/* ✅ Keep Summary, Debt Category, and Spending Type at the Top */}
              <p
                className={`text-2xl font-bold ${getColorClass(
                  debtPercentage || 0
                )} text-center`}
              >
                {spendingType}
              </p>
              <p className="text-gray-800 text-sm">{spendingSummary}</p>
            </>
          )}
        </div>
        {/* Transactions List */}
        {transactions.length > 0 && !loadingTransactions && (
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your Transactions
            </h2>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.map((t, i) => {


                return (
                  <li key={i} className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        {t.date} - {t.name}
                      </span>
                      <span className="font-semibold text-gray-900">
                        ${t.amount.toFixed(2)}
                        {!analyzing && (
                          <span
                            className={`ml-2 font-bold ${getColorClass(
                              t.ethicsScore
                            )}`}
                          >
                            ({t.ethicsScore})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* 🔥 Unethical Practice Badges */}
                    {Array.isArray(t.unethicalPractices) &&
                      t.unethicalPractices.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {t.unethicalPractices.map((badge, index) => (
                            <span
                              key={index}
                              className="bg-red-200 text-red-700 text-xs px-2 py-1 rounded-lg"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    {/* 🌱 Ethical Practice Badges */}
                    {Array.isArray(t.ethicalPractices) &&
                      t.ethicalPractices.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {t.ethicalPractices.map((badge, index) => (
                            <span
                              key={index}
                              className="bg-green-200 text-green-700 text-xs px-2 py-1 rounded-lg"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ✅ Aggregate charity donations and sort by amount */}
        {totalSocietalDebt !== null && !analyzing && (
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start border-t border-gray-300 pt-4">
              {/* ✅ Ensure table only renders if there are donations */}
              {Object.keys(practiceDonations).length > 0 && (
                <div className="w-full text-left">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left text-gray-700 p-2">
                          Practice
                        </th>
                        <th className="text-left text-gray-700 p-2">
                          Suggested Charity
                        </th>
                        <th className="text-right text-gray-700 p-2">
                          Contribution
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(practiceDonations)
                        .sort(([, a], [, b]) => b.amount - a.amount) // Sort by highest donation amount
                        .map(([practice, { charity, amount }], i) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td
                              className={`p-2 font-medium ${
                                charity ? "text-red-600" : "text-green-600"
                              }`}
                            >
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
                            <td
                              className={`p-2 text-right font-bold ${
                                charity ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              ${amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* ✅ Amount Due - Moved Below the Table */}
                  <div className="text-right mt-4 border-t border-gray-300 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Total Debt:
                    </h3>
                    <p
                      className={`text-${
                        totalSocietalDebt > 0 ? "red-500" : "green-500"
                      } text-2xl font-bold`}
                    >
                      ${totalSocietalDebt?.toFixed(2) || "Pending..."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
