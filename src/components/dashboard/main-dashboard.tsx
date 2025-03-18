import React, { useState} from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert';
import Dashboard from './dashboard-ui';
import OffsetModal from './offset-modal';
import VendorImpactTab from './vendor-impact-tab';
import ImpactVisualizations from './impact-visualizations';
import RecommendationsComponent from './recommendations-component';

interface MainDashboardProps {
  user: User | null;
  transactions: Transaction[];
  totalSocietalDebt: number | null;
  isLoading: boolean;
  error: string | null;
  isBankConnected: boolean;
  onConnectBank: (token: string) => void;
  onDisconnectBank: () => void;
  onSaveTransactions?: (transactions: Transaction[], totalDebt: number) => Promise<void>;
}

const MainDashboard: React.FC<MainDashboardProps> = ({
  user,
  transactions,
  totalSocietalDebt,
  isLoading,
  error,
  isBankConnected,
  onConnectBank,
  onDisconnectBank,
  // onSaveTransactions
}) => {
  // State for the active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'visualizations' | 'recommendations'>('overview');
  
  // State for offset modal
  const [offsetModalOpen, setOffsetModalOpen] = useState(false);
  const [offsetPractice, setOffsetPractice] = useState<string>('');
  const [offsetAmount, setOffsetAmount] = useState<number>(0);
  
  // Handle tab changes
  const handleTabChange = (tab: 'overview' | 'vendors' | 'visualizations' | 'recommendations') => {
    setActiveTab(tab);
  };
  
  // Handle offset button click
  const handleOffsetClick = (practice: string, amount: number) => {
    setOffsetPractice(practice);
    setOffsetAmount(amount);
    setOffsetModalOpen(true);
  };
  
  // Handle donation completion
  const handleDonationComplete = (charityId: string, amount: number) => {
    console.log(`Donation of $${amount} completed to charity ${charityId} for practice ${offsetPractice}`);
    
    // Close the modal
    setOffsetModalOpen(false);
    
    // In a real app, you would record this donation and update the user's impact
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full">
          <LoadingSpinner message="Analyzing your transactions..." />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ethinomic Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Track and improve the ethical impact of your spending
          </p>
        </div>
        
        {/* Error display */}
        {error && <ErrorAlert message={error} />}
        
        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* User profile card */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center space-x-3">
                  <div className="bg-white bg-opacity-30 rounded-full p-2">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">{user?.displayName || user?.email?.split('@')[0] || 'User'}</h2>
                    <p className="text-sm text-blue-100">{user?.email || ''}</p>
                  </div>
                </div>
              </div>
              
              {/* Summary stats */}
              <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">Transactions</div>
                    <div className="text-lg font-bold text-gray-800">{transactions.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Impact</div>
                    <div className={`text-lg font-bold ${totalSocietalDebt && totalSocietalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(totalSocietalDebt || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Dashboard</h3>
                <nav className="space-y-2">
                  <button
                    onClick={() => handleTabChange('overview')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      activeTab === 'overview' 
                        ? 'bg-blue-50 text-blue-800' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => handleTabChange('vendors')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      activeTab === 'vendors' 
                        ? 'bg-blue-50 text-blue-800' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Vendor Analysis
                  </button>
                  <button
                    onClick={() => handleTabChange('visualizations')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      activeTab === 'visualizations' 
                        ? 'bg-blue-50 text-blue-800' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Visualizations
                  </button>
                  <button
                    onClick={() => handleTabChange('recommendations')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      activeTab === 'recommendations' 
                        ? 'bg-blue-50 text-blue-800' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Recommendations
                  </button>
                </nav>
              </div>
              
              {/* Account actions */}
              <div className="p-4 border-t border-gray-200">
                <div className="space-y-2">
                  {isBankConnected ? (
                    <button
                      onClick={onDisconnectBank}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                    >
                      Disconnect Bank
                    </button>
                  ) : (
                    <button
                      onClick={() => alert("Connect Bank functionality would be here")}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Connect Bank
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick stats card */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Impact Summary</h3>
                
                {/* Impact gauge */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Positive</span>
                    <span>Neutral</span>
                    <span>Negative</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    {totalSocietalDebt !== null && (
                      <div 
                        className={`h-full ${totalSocietalDebt > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ 
                          width: `${Math.min(Math.abs(totalSocietalDebt) / (transactions.reduce((sum, tx) => sum + tx.amount, 0) || 1) * 300, 100)}%`,
                          marginLeft: totalSocietalDebt > 0 ? '50%' : 'auto',
                          marginRight: totalSocietalDebt <= 0 ? '50%' : 'auto',
                        }}
                      ></div>
                    )}
                  </div>
                </div>
                
                {/* Top impacts */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Top Impact Areas:</div>
                  <div className="space-y-1">
                    {Array.from(
                      transactions.reduce((practices, tx) => {
                        (tx.unethicalPractices || []).forEach(practice => {
                          practices.set(practice, (practices.get(practice) || 0) + 1);
                        });
                        return practices;
                      }, new Map<string, number>())
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([practice, count]) => (
                        <div key={practice} className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">{practice}</span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Main content area */}
          <div className="lg:col-span-3">
            {/* Tab content */}
            <div className="bg-white rounded-lg shadow-sm">
              {activeTab === 'overview' && (
                <Dashboard 
                  user={user} 
                  transactions={transactions}
                  totalSocietalDebt={totalSocietalDebt}
                  isLoading={isLoading}
                  error={error}
                  isBankConnected={isBankConnected}
                  handleConnectBank={onConnectBank}
                  handleDisconnectBank={onDisconnectBank}
                />
              )}
              
              {activeTab === 'vendors' && (
                <VendorImpactTab 
                  transactions={transactions}
                  totalSocietalDebt={totalSocietalDebt}
                  onOffsetVendor={(vendor, amount) => handleOffsetClick(vendor, amount)}
                />
              )}
              
              {activeTab === 'visualizations' && (
                <ImpactVisualizations 
                  transactions={transactions}
                  totalSocietalDebt={totalSocietalDebt}
                />
              )}
              
              {activeTab === 'recommendations' && (
                <RecommendationsComponent 
                  transactions={transactions}
                  totalSocietalDebt={totalSocietalDebt}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Ethinomics - Helping you make more ethical financial decisions</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Ethinomics, Inc.</p>
        </div>
      </div>
      
      {/* Offset Modal */}
      {offsetModalOpen && (
        <OffsetModal
          practice={offsetPractice}
          amount={offsetAmount}
          isOpen={offsetModalOpen}
          onClose={() => setOffsetModalOpen(false)}
          onDonate={handleDonationComplete}
        />
      )}
    </div>
  );
};

export default MainDashboard;