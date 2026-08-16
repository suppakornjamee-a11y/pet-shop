import type { Locale } from "./config";
import th from "./dictionaries/th";
import en from "./dictionaries/en";

const dictionaries = { th, en };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
