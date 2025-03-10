import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) router.push('/signin');
    });
    return () => unsubscribe();
  }, [router]);
  
  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/signin');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  return { user, loading, logout };
}