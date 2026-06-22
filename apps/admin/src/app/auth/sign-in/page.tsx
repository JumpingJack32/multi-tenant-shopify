"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import {
  Button,
  Field,
  Input,
  Label,
} from "@repo/ui/styles/base-ui";

export default function SignInPage() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isLoaded) {
      setError("Clerk not loaded");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn.create({
        identifier,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.href = "/";
      } else {
        setError("Sign in incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "28rem",
        margin: "4rem auto",
        padding: "2rem",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
      }}
    >
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>
        Sign in to Admin
      </h1>

      <form onSubmit={handleSubmit}>
        <Field>
          <Label>Email</Label>
          <Input
            type="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </Field>

        <Field style={{ marginTop: "1rem" }}>
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </Field>

        {error && (
          <p
            style={{ color: "#dc2626", marginTop: "0.75rem", fontSize: "0.875rem" }}
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          style={{ width: "100%", marginTop: "1.5rem" }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
