import snapshot from '../../content/generated/translations.json';
import { messages } from '../../content/messages.mjs';
export const languages = ['ko', 'ja'] as const;
export type Language = typeof languages[number];
export type MessageKey = keyof typeof messages;
export function translator(lang: Language) {
  return (key: MessageKey, params: Record<string, string | number> = {}) => {
    let value: string = (snapshot as Record<string, Record<string, string>>)[lang]?.[key] || messages[key][lang] || messages[key].ko;
    for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
    return value;
  };
}
export const date = (value: string) => value.replace('-', '.');
export const path = (lang: Language, page: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${lang}/${page}/`;

// Japanese headings wrap according to their available width, not editorial line breaks.
export function heading(lang: Language, key: MessageKey) {
  const text = translator(lang)(key);
  return lang === 'ja' ? text.replace(/\r?\n/g, '') : text;
}
