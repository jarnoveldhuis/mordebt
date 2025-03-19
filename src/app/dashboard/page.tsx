"use client";

import { useCallback, useState } from "react";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { config } from "@/config";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { GroupedImpactSummary } from "@/features/analysis/GroupedImpactSummary";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { TransactionList } from "@/features/analysis/TransactionList";
import { ConsolidatedImpactView } from "@/features/analysis/ConsolidatedImpactView";
import { CategoryExperimentView } from "@/features/analysis/CategoryExperimentView";
import { PracticeDebtTable } from "@/features/analysis/PracticeDebtTable";
import { useSampleData } from "@/features/debug/useSampleData";
import { useDashboardState } from "@/features/dashboard/useDashboardState";
import { 
  calculatePracticeDonations,
  calculatePositiveAmount,
  calculateNegativeAmount,
  calculateNegativeCategories,
  getColorClass
} from "@/features/dashboard/dashboardUtils";
import { 
  DashboardLoading, 
  DashboardEmptyState 
} from "@/features/dashboard/DashboardLoading";
import { DebugPanel } from "@/features/dashboard/DebugPanel";
import { EmergencyDisconnect } from '@/features/banking/EmergencyDisconnect';

// Determine if we're in development/sandbox mode
const isSandboxMode =
  process.env.NODE_ENV === "development" || config.plaid.isSandbox;

export default function Dashboard() {
  // Use the dashboard state hook to manage state
  const {
    user,
    activeView,
    showDebugPanel,
    displayTransactions,
    totalSocietalDebt,
    effectiveConnectionStatus,
    error,
    hasData,
    isLoading,
    authLoading,
    bankConnecting,
    
    setActiveView,
    setShowDebugPanel,
    
    handlePlaidSuccess,
    handleLoadSampleData: hookHandleLoadSampleData,
    handleResetTransactions,
    applyCreditToDebt,
    logout,
    
    loadingMessage
  } = useDashboardState();

  // Add state to track when connecting is happening
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Get the sample data generation functions
  const { generateSampleTransactions } = useSampleData();

  // Calculate derived data
  const practiceDonations = calculatePracticeDonations(displayTransactions);
  const positiveAmount = calculatePositiveAmount(displayTransactions);
  const negativeAmount = calculateNegativeAmount(displayTransactions);
  const negativeCategories = calculateNegativeCategories(displayTransactions);

  // Handle loading sample data from debug panel
  const handleLoadSampleData = useCallback(() => {
    const sampleTransactions = generateSampleTransactions();
    hookHandleLoadSampleData(sampleTransactions);
  }, [generateSampleTransactions, hookHandleLoadSampleData]);

  // Handle connect button click with transition state
  const handleConnectBank = useCallback(() => {
    setIsConnecting(true);
  }, []);

  // Get the currently active view component
  const renderActiveView = () => {
    if (isLoading) {
      return <DashboardLoading message={loadingMessage} />;
    }

    if (!hasData) {
      return (
        <DashboardEmptyState 
          effectiveConnectionStatus={effectiveConnectionStatus}
          onDisconnectBank={() => {}}
          bankConnecting={bankConnecting}
          isConnecting={isConnecting}
        />
      );
    }

    // Render appropriate view based on active tab
    switch (activeView) {
      case "impact":
        return (
          <ConsolidatedImpactView
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "categories":
        return (
          <CategoryExperimentView
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "practices":
        return (
          <PracticeDebtTable
            practiceDonations={practiceDonations}
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "grouped-impact":
        return (
          <GroupedImpactSummary
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt}
          />
        );
      case "transactions":
      default:
        return (
          <TransactionList
            transactions={displayTransactions}
            getColorClass={getColorClass}
          />
        );
    }
  };

  // Handle loading states
  if (authLoading) {
    return (
      <div className="text-center mt-10">
        <DashboardLoading message="Checking authentication..." />
      </div>
    );
  }

  // Redirect if no user is found (handled by useAuth hook)
  if (!user) {
    return <div className="text-center mt-10">Redirecting to login...</div>;
  }

  // Main render
  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
      isBankConnected={effectiveConnectionStatus}
    >
      {/* Error display */}
      {error && <ErrorAlert message={error} />}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <DashboardSidebar
          user={user}
          activeView={activeView}
          onViewChange={setActiveView}
          totalSocietalDebt={totalSocietalDebt}
          offsetsThisMonth={negativeAmount}
          positiveImpact={positiveAmount}
          topNegativeCategories={negativeCategories}
          hasTransactions={hasData}
          onApplyCredit={applyCreditToDebt}
        />

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Bank Connection Section - Only shown when not connected */}
          {!effectiveConnectionStatus && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-sm text-blue-700 mb-4">
                Connect your bank account to analyze your transactions and
                calculate your societal debt.
              </p>
              <PlaidConnectionSection
                onSuccess={handlePlaidSuccess}
                isConnected={effectiveConnectionStatus}
                isLoading={isConnecting || bankConnecting}
              />
            </div>
          )}

          {/* Main view content */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {renderActiveView()}
          </div>

          {/* Debug panel */}
          <DebugPanel
            user={user}
            isSandboxMode={isSandboxMode}
            showDebugPanel={showDebugPanel}
            onToggleDebugPanel={() => setShowDebugPanel(!showDebugPanel)}
            onLoadSampleData={handleLoadSampleData}
            onResetTransactions={handleResetTransactions}
          />

          {/* Keep the emergency disconnect as a fallback but with modified text */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl shadow-sm p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Emergency Reset</h3>
            <p className="text-sm text-red-700 mb-3">
              If you're having problems with your bank connection, use this emergency reset button. This will clear all connection data and let you reconnect.
            </p>
            <EmergencyDisconnect />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Simple version of the client component
function DashboardClient() {
  return (
    <div className="p-4">
      <h1>Dashboard</h1>
      <EmergencyDisconnect />
    </div>
  );
}