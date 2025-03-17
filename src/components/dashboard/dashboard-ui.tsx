import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert';

// Define types for our dashboard
interface DashboardProps {
  user: User | null;
  transactions: Transaction[];
  totalSocietalDebt: number | null;
  isLoading: boolean;
  error: string | null;
  isBankConnected: boolean;
  handleConnectBank: (token: string) => void;
  handleDisconnectBank: () => void;
}

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getImpactColor = (value: number): string => {
  if (value < 0) return "text-green-600"; // Positive impact (reduces debt)
  if (value === 0) return "text-gray-600"; // Neutral impact
  if (value < 15) return "text-yellow-600"; // Low negative impact
  if (value < 30) return "text-orange-600"; // Medium negative impact
  return "text-red-600"; // High negative impact
};

const getProgressColor = (value: number): string => {
  if (value < 0) return "bg-green-500"; // Positive impact (reduces debt)
  if (value === 0) return "bg-gray-400"; // Neutral impact
  if (value < 15) return "bg-yellow-500"; // Low negative impact
  if (value < 30) return "bg-orange-500"; // Medium negative impact
  return "bg-red-500"; // High negative impact
};

// Main Dashboard Component
const Dashboard: React.FC<DashboardProps> = ({
  // user: user,
  transactions,
  totalSocietalDebt,
  isLoading,
  error,
  isBankConnected,
  // handleConnectBank,
  handleDisconnectBank
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'categories'>('overview');
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);
  
  // Aggregate data for visualization
  const practiceImpacts = React.useMemo(() => {
    const impacts: Record<string, { amount: number, count: number, isEthical: boolean }> = {};
    
    transactions.forEach(tx => {
      // Process unethical practices (positive societal debt)
      (tx.unethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 0;
        const amount = tx.amount * (weight / 100);
        
        if (!impacts[practice]) {
          impacts[practice] = { amount: 0, count: 0, isEthical: false };
        }
        
        impacts[practice].amount += amount;
        impacts[practice].count += 1;
      });
      
      // Process ethical practices (negative societal debt)
      (tx.ethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 0;
        const amount = tx.amount * (weight / 100) * -1; // Make it negative
        
        if (!impacts[practice]) {
          impacts[practice] = { amount: 0, count: 0, isEthical: true };
        }
        
        impacts[practice].amount += amount;
        impacts[practice].count += 1;
      });
    });
    
    // Convert to array and sort by absolute impact
    return Object.entries(impacts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [transactions]);
  
  // Total spend amount
  const totalSpend = React.useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);
  
  // Calculate debt percentage
  const debtPercentage = React.useMemo(() => {
    if (!totalSocietalDebt || totalSpend === 0) return 0;
    return (totalSocietalDebt / totalSpend) * 100;
  }, [totalSocietalDebt, totalSpend]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <LoadingSpinner message="Analyzing your transactions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <ErrorAlert message={error} />
      </div>
    );
  }

  if (!isBankConnected) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md text-center">
        <div className="text-6xl mb-4">🏦</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Connect Your Bank Account</h2>
        <p className="text-gray-600 mb-6">
          Connect your bank account to analyze the ethical impact of your transactions.
        </p>
        <button 
          onClick={() => alert("This would trigger Plaid connection in the actual app")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Connect Bank
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">No Transactions Found</h2>
        <p className="text-gray-600 mb-6">
          We couldn not find any transactions in your connected account.
        </p>
        <button
          onClick={handleDisconnectBank}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try Another Account
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-3 font-medium text-sm focus:outline-none ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm focus:outline-none ${
            activeTab === 'transactions'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm focus:outline-none ${
            activeTab === 'categories'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Total Transactions */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Transactions Analyzed</div>
                <div className="text-2xl font-bold text-gray-800">{transactions.length}</div>
              </div>
              
              {/* Total Spending */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Total Spending</div>
                <div className="text-2xl font-bold text-gray-800">{formatCurrency(totalSpend)}</div>
              </div>
              
              {/* Ethical Impact */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Ethical Impact</div>
                <div className={`text-2xl font-bold ${getImpactColor(totalSocietalDebt || 0)}`}>
                  {formatCurrency(Math.abs(totalSocietalDebt || 0))}
                  <span className="text-sm ml-1">
                    {totalSocietalDebt && totalSocietalDebt > 0 ? 'negative' : 'positive'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Impact Visualization */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Impact Score</h3>
              <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>0%</span>
                  <span>Impact Percentage: {debtPercentage.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getProgressColor(debtPercentage)}`}
                    style={{ width: `${Math.min(Math.max(debtPercentage, 0), 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {debtPercentage <= 5 ? 'Excellent! Your spending has minimal negative impact.' :
                   debtPercentage <= 15 ? 'Good. Your spending has moderate ethical impact.' :
                   debtPercentage <= 30 ? 'Consider making some changes to reduce your ethical impact.' :
                   'Your spending has significant ethical concerns.'}
                </div>
              </div>
            </div>
            
            {/* Top Impacts */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Top Ethical Impacts</h3>
              <div className="space-y-3">
                {practiceImpacts.slice(0, 5).map((practice) => (
                  <div key={practice.name} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{practice.name}</span>
                      <span className={`font-bold ${getImpactColor(practice.amount)}`}>
                        {formatCurrency(Math.abs(practice.amount))}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={practice.isEthical ? "h-full bg-green-500" : "h-full bg-red-500"}
                        style={{ width: `${Math.min((Math.abs(practice.amount) / totalSpend) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Appears in {practice.count} transaction{practice.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
              
              {practiceImpacts.length > 5 && (
                <button 
                  onClick={() => setActiveTab('categories')}
                  className="mt-3 text-blue-600 text-sm font-medium hover:underline"
                >
                  View All Impacts
                </button>
              )}
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Transactions</h3>
            <div className="space-y-3">
              {transactions.slice(0, 10).map((tx, index) => (
                <div key={index} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{tx.name}</div>
                      <div className="text-sm text-gray-500">{tx.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(tx.amount)}</div>
                      <div className={`text-sm ${getImpactColor(tx.societalDebt || 0)}`}>
                        Impact: {formatCurrency(Math.abs(tx.societalDebt || 0))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Practices */}
                  {((tx.unethicalPractices && tx.unethicalPractices.length > 0) || 
                    (tx.ethicalPractices && tx.ethicalPractices.length > 0)) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tx.unethicalPractices?.map(practice => (
                        <span 
                          key={practice} 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                        >
                          {practice}
                        </span>
                      ))}
                      {tx.ethicalPractices?.map(practice => (
                        <span 
                          key={practice} 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          {practice}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {transactions.length > 10 && (
                <div className="text-center p-3 border rounded-lg bg-gray-50">
                  <span className="text-gray-500">
                    Showing 10 of {transactions.length} transactions
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Impact Categories</h3>
            
            {/* Category Filter (simplified) */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedPractice(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedPractice === null 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedPractice('unethical')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedPractice === 'unethical' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Negative Impact
              </button>
              <button
                onClick={() => setSelectedPractice('ethical')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedPractice === 'ethical' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Positive Impact
              </button>
            </div>
            
            {/* Practice List */}
            <div className="space-y-3">
              {practiceImpacts
                .filter(practice => 
                  selectedPractice === null || 
                  (selectedPractice === 'ethical' && practice.isEthical) ||
                  (selectedPractice === 'unethical' && !practice.isEthical)
                )
                .map((practice) => (
                  <div 
                    key={practice.name} 
                    className={`p-3 border rounded-lg ${
                      practice.isEthical ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{practice.name}</span>
                      <span className={`font-bold ${getImpactColor(practice.amount)}`}>
                        {formatCurrency(Math.abs(practice.amount))}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={practice.isEthical ? "h-full bg-green-500" : "h-full bg-red-500"}
                        style={{ width: `${Math.min((Math.abs(practice.amount) / totalSpend) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {practice.isEthical 
                        ? 'This represents a positive ethical impact from your spending.' 
                        : 'This represents a negative ethical impact from your spending.'}
                    </div>
                    <div className="mt-2">
                      <button 
                        className={`text-sm font-medium ${
                          practice.isEthical ? 'text-green-600 hover:text-green-800' : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        {practice.isEthical ? 'View Details' : 'Offset Impact'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;