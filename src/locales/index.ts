import en from "./en.json";
import tl from "./tl.json";
import ceb from "./ceb.json";
import type { Lang } from "../types";

/**
 * Every user-facing string lives in a catalog here, one JSON file per language.
 * en.json is the source of truth: keys are typed from it, and any key a translation lacks falls back to English.
 * Curriculum content keeps its English in src/data; translations of it sit under curriculum.* / skills.* / misconceptions.*.
 * To add a language: add <code>.json, its code to Lang in src/types.ts, and a row to LANGS.
 */
export const LANGS: readonly { code: Lang; name: string; ai: string }[] = [
  { code: "en", name: "English", ai: "English" },
  { code: "tl", name: "Tagalog", ai: "Tagalog (Filipino)" },
  { code: "ceb", name: "Bisaya", ai: "Cebuano (Bisaya)" },
];

type Catalog = typeof en;
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type StringKey = Leaves<Catalog>;
/** Keys with .one/.other children, for counts: t.plural("home.gapsFixed", n). */
export type PluralKey = StringKey extends infer K ? (K extends `${infer P}.one` ? P : never) : never;
export type Vars = Record<string, string | number>;

const CATALOGS: Record<Lang, unknown> = { en, tl, ceb };

/** Older builds saved "fil"; anything unknown becomes English. */
export function normalizeLang(v: unknown): Lang {
  if (v === "fil") return "tl";
  return LANGS.some((l) => l.code === v) ? (v as Lang) : "en";
}

function lookup(catalog: unknown, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" && node !== "" ? node : undefined;
}

/** The raw string for a key: the language's own, else English, else the key itself. */
export function raw(lang: Lang, key: StringKey): string {
  return lookup(CATALOGS[lang], key) ?? lookup(en, key) ?? key;
}

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const s = raw(lang, key);
  return vars ? s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : s;
}

/** For keys built from data ids. Undefined when neither the language nor English has it. */
export function translateMaybe(lang: Lang, key: string): string | undefined {
  return lookup(CATALOGS[lang], key) ?? lookup(en, key);
}
