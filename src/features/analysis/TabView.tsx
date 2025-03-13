// src/features/analysis/TabView.tsx
import React, { useState, useEffect } from "react";
import { Transaction } from "@/shared/types/transactions";
import { ConsolidatedImpactView } from "./ConsolidatedImpactView";
import { TransactionList } from "./TransactionList";
import { CategoryExperimentView } from "./CategoryExperimentView";

interface TabViewProps {
  transactions: Transaction[];
  totalSocietalDebt: number;
  getColorClass: (value: number) => string;
}

type TabType = "impact" | "transactions" | "categories";

export function TabView({
  transactions,
  totalSocietalDebt,
  getColorClass,
}: TabViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("transactions");

  // Set the initial active tab based on whether analysis is completed
  useEffect(() => {
    if (transactions.length > 0 && totalSocietalDebt !== null) {
      // If transactions are loaded and analyzed, default to transactions view
      setActiveTab("transactions");
    }
  }, [transactions.length, totalSocietalDebt]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tab Navigation - responsive for mobile */}
      <div className="flex flex-wrap border-b">
        <TabButton
          active={activeTab === "impact"}
          onClick={() => setActiveTab("impact")}
        >
          Impact Summary
        </TabButton>
        <TabButton
          active={activeTab === "transactions"}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </TabButton>
        <TabButton
          active={activeTab === "categories"}
          onClick={() => setActiveTab("categories")}
          className="text-xs sm:text-sm"
        >
          Categories
        </TabButton>
      </div>

      {/* Tab Content - Content aligned to top */}
      <div className="p-0">
        {activeTab === "impact" && (
          <ConsolidatedImpactView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
        {activeTab === "transactions" && (
          <TransactionList
            transactions={transactions}
            getColorClass={getColorClass}
          />
        )}
        {activeTab === "categories" && (
          <CategoryExperimentView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        )}
      </div>
    </div>
  );
}

// Helper component for tab buttons
function TabButton({ 
  children, 
  active, 
  onClick,
  className = ""
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm focus:outline-none ${
        active
          ? "border-b-2 border-blue-500 text-blue-600"
          : "text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:border-b"
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}