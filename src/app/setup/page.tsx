import { Card } from "@/components/shared/card";

export default function SetupPage() {
  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-2xl rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Setup required
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-black dark:text-white">
          Connect Supabase to run production auth
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
          Add these environment variables from your Supabase project settings,
          then apply the migration in <code>supabase/migrations</code>.
        </p>
        <pre className="mt-5 whitespace-pre-wrap break-all rounded-md bg-black p-4 text-sm text-white dark:bg-stone-950 dark:ring-1 dark:ring-white/10">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
        </pre>
      </Card>
    </main>
  );
}
