import { cookies } from "next/headers";

import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "./config";
import { dictionaries, type Dict } from "./dictionaries";

// Server-side language resolution from the `lang` cookie. Used by Server
// Components, pages, layouts, and server actions so returned/rendered text is
// localized. Falls back to the default language (Slovak).
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function getDict(): Promise<Dict> {
  return dictionaries[await getLang()];
}
