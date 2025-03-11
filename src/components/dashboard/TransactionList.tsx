import { Transaction } from "@/types/transactions";
import { TransactionListItem } from "./TransactionListItem";

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
      
      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No transactions found.</p>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {transactions.map((transaction, index) => (
            <TransactionListItem 
              key={index}
              transaction={transaction}
              getColorClass={getColorClass}
            />
          ))}
        </ul>
      )}
    </div>
  );
}