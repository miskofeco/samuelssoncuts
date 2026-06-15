import { signInAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { Button } from "@/components/shared/button";
import { Field } from "@/components/shared/form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthPanel error={params.error} message={params.message} mode="login">
      <form action={signInAction} className="space-y-4">
        <Field
          required
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
        />
        <Field
          required
          label="Password"
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
        />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </AuthPanel>
  );
}
