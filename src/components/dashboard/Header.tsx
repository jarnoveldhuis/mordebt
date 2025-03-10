import { User } from "firebase/auth";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <span className="text-sm text-gray-500">
        {user?.email}
      </span>
      <button
        onClick={onLogout}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
      >
        Logout
      </button>
    </div>
  );
}