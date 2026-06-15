import { registerAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/shared/button";
import { Field } from "@/components/shared/form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthPanel error={params.error} mode="register">
      <form action={registerAction} className="space-y-4">
        <Field
          required
          label="Full name"
          name="fullName"
          placeholder="Alex Morgan"
        />
        <Field
          required
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
        />
        <Field required label="Phone" name="phone" placeholder="+421 ..." />
        <Field
          required
          label="Password"
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
        />
        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>
      <OAuthButtons />
    </AuthPanel>
  );
}
