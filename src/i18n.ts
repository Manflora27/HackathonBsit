import { Fragment, createElement, useCallback, type ReactNode } from "react";
import { useStore } from "./store";
import { goalMeta, subjectMeta, verifierMeta, type Goal, type PlanUnit, type SubjectGroup, type SubjectId, type VerifierId } from "./data/curriculum";
import { raw, translate, translateMaybe, type PluralKey, type StringKey, type Vars } from "./locales";
import type { Lang } from "./types";

export { LANGS, normalizeLang, type StringKey } from "./locales";

/** Topic lists from the curriculum guides are lowercase; titles start with a capital. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Like translate, but placeholders can be elements: rich("x.y", { email: <b>{email}</b> }). */
function translateRich(lang: Lang, key: StringKey, parts: Record<string, ReactNode>): ReactNode {
  return raw(lang, key).split(/(\{\w+\})/g).map((chunk, i) => {
    const name = /^\{(\w+)\}$/.exec(chunk)?.[1];
    return createElement(Fragment, { key: i }, name && name in parts ? parts[name] : chunk);
  });
}

export function useLang(): Lang {
  return useStore((s) => s.lang);
}

export function useT() {
  const lang = useLang();
  const t = useCallback((key: StringKey, vars?: Vars) => translate(lang, key, vars), [lang]);
  return Object.assign(t, {
    lang,
    rich: (key: StringKey, parts: Record<string, ReactNode>) => translateRich(lang, key, parts),
    maybe: (key: string) => translateMaybe(lang, key),
    plural: (key: PluralKey, count: number, vars?: Vars) =>
      translate(lang, `${key}.${count === 1 ? "one" : "other"}` as StringKey, { count, ...vars }),
    // Curriculum content: English lives in the data, translations under curriculum.* in the catalogs.
    subject: (id: SubjectId) => translateMaybe(lang, `curriculum.subjects.${id}.name`) ?? subjectMeta[id].en,
    subjectBlurb: (id: SubjectId) => translateMaybe(lang, `curriculum.subjects.${id}.blurb`) ?? subjectMeta[id].blurb,
    group: (g: SubjectGroup) => translateMaybe(lang, `curriculum.groups.${g.id}`) ?? g.en,
    goal: (g: Goal) => translateMaybe(lang, `curriculum.goals.${g}`) ?? goalMeta[g].en,
    unit: (u: PlanUnit) => cap(translateMaybe(lang, `curriculum.domains.${u.titleKey}`) ?? translateMaybe(lang, u.titleKey) ?? u.title),
    verifier: (v: VerifierId) => translateMaybe(lang, `curriculum.verifiers.${v}`) ?? verifierMeta[v].en,
  });
}
