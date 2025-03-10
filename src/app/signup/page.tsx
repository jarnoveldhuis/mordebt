"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/firebase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Created user:", userCredential.user.uid);

      // Additional steps (e.g., store user doc in Firestore) can go here

      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Firebase sign-up error:", err.message);
        setError(err.message || "Something went wrong");
      } else if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        "message" in err
      ) {
        // Firebase errors often have `code` and `message`
        const firebaseError = err as { code: string; message: string };
        console.error(
          "Firebase sign-up error:",
          firebaseError.code,
          firebaseError.message
        );
        setError(firebaseError.message || "Something went wrong");
      } else {
        console.error("Unknown error during Firebase sign-up:", err);
        setError("Something went wrong");
      }
    }
  };
  return (
    <div>
      <h1>Create Account</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>Account created!</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />
        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
}
