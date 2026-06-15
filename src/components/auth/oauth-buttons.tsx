import { signInWithOAuthAction } from "@/app/actions";
import { buttonClass } from "@/components/shared/button";

// Social sign-in / sign-up. The same OAuth flow handles both: Supabase creates
// the auth user on first consent, and the handle_new_user() DB trigger seeds a
// pending profile. Plain form posts to a server action — no client JS needed.
export function OAuthButtons() {
  return (
    <div>
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
          or
        </span>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <div className="grid gap-2.5">
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="google" />
          <button type="submit" className={buttonClass("secondary", "w-full gap-2.5")}>
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        {/* Apple sign-in needs a paid Apple Developer account ($99/yr). Re-add a
            second <form> with provider="apple" + <AppleIcon /> once that exists —
            the server action already accepts "apple". */}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9082c1.7018-1.5668 2.6841-3.874 2.6841-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1818l-2.9082-2.2581c-.8059.54-1.8368.859-3.0482.859-2.344 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

