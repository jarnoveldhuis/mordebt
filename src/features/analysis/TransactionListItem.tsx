import { Transaction } from "@/shared/types/transactions";

interface TransactionListItemProps {
  transaction: Transaction;
  getColorClass: (value: number) => string;
}

export function TransactionListItem({ transaction, getColorClass }: TransactionListItemProps) {
  const { 
    date, 
    name, 
    amount, 
    societalDebt = 0, 
    unethicalPractices = [], 
    ethicalPractices = [], 
    practiceWeights = {}
  } = transaction;
  
  // Create badges for practices without showing information
  const allPractices = [
    ...unethicalPractices.map(practice => ({
      practice,
      text: `${practice} (${practiceWeights[practice] || 0}%)`,
      type: "unethical"
    })),
    ...ethicalPractices.map(practice => ({
      practice,
      text: `${practice} (${practiceWeights[practice] || 0}%)`,
      type: "ethical"
    }))
  ];

  return (
    <li className="bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition duration-200">
      <div className="flex justify-between">
        <div className="flex flex-col">
          <span className="font-medium text-gray-800">{name}</span>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-gray-700">${amount.toFixed(2)}</span>
          <span className={`font-medium ${getColorClass(societalDebt)}`}>
            ${societalDebt.toFixed(2)}
          </span>
        </div>
      </div>

      {allPractices.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {allPractices.map((practiceInfo, idx) => {
            const bgColor = practiceInfo.type === "unethical"
              ? "bg-red-100 text-red-700 border-red-200"
              : "bg-green-100 text-green-700 border-green-200";
            
            return (
              <span 
                key={idx} 
                className={`${bgColor} px-2 py-1 rounded-full text-xs`}
              >
                {practiceInfo.text}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}