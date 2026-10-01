// UI copy for the lesson's "I'm stuck" panel: a simpler explanation, a hint,
// and one worked example per skill. Static and offline, no AI calls.
// Filipino text needs the same native-speaker check as lessons.json.
import type { Lang } from "../types";

export interface StuckHelp {
  simple: string; // may contain $...$ math
  hint: string;
  example: { given: string; steps: string[] }; // LaTeX
}

const H: Record<string, Record<Lang, StuckHelp>> = {
  int_ops: {
    en: {
      simple: "Picture a number line. Adding a negative moves you left. Multiplying two negatives gives a positive.",
      hint: "For × and ÷, check the signs first: same signs → positive, different signs → negative.",
      example: { given: "(-3)(-4) + (-5)", steps: ["(-3)(-4) = 12", "12 + (-5) = 7"] },
    },
    fil: {
      simple: "Isipin ang number line. Kapag nag-add ng negative, pakaliwa ka. Kapag nag-multiply ng dalawang negative, positive ang sagot.",
      hint: "Sa × at ÷, tingnan muna ang sign: pareho → positive, magkaiba → negative.",
      example: { given: "(-3)(-4) + (-5)", steps: ["(-3)(-4) = 12", "12 + (-5) = 7"] },
    },
  },
  like_terms: {
    en: {
      simple: "Like terms have the same letter part. $3x + 2x$ is like 3 apples plus 2 apples: $5x$. You can't merge $x$ with a plain number.",
      hint: "Group the $x$ terms together and the plain numbers together, then add each group.",
      example: { given: "3x + 5 + 2x - 1", steps: ["(3x + 2x) + (5 - 1)", "5x + 4"] },
    },
    fil: {
      simple: "Ang like terms ay may parehong letter. Ang $3x + 2x$ ay parang 3 mansanas at 2 mansanas: $5x$. Hindi puwedeng pagsamahin ang $x$ at ang numero lang.",
      hint: "Pagsamahin ang lahat ng $x$, at hiwalay ang mga numero. Tapos i-add ang bawat grupo.",
      example: { given: "3x + 5 + 2x - 1", steps: ["(3x + 2x) + (5 - 1)", "5x + 4"] },
    },
  },
  exponents: {
    en: {
      simple: "$x^3$ just means $x \\cdot x \\cdot x$. When you multiply powers of $x$, count all the $x$'s: add the exponents.",
      hint: "Same base multiplied → add exponents. A power of a power → multiply exponents.",
      example: { given: "x^2 \\cdot x^3", steps: ["(x \\cdot x)(x \\cdot x \\cdot x)", "x^5"] },
    },
    fil: {
      simple: "Ang $x^3$ ay $x \\cdot x \\cdot x$ lang. Kapag nag-multiply ng powers ng $x$, bilangin lahat ng $x$: i-add ang exponents.",
      hint: "Parehong base na mina-multiply → i-add ang exponents. Power ng power → i-multiply ang exponents.",
      example: { given: "x^2 \\cdot x^3", steps: ["(x \\cdot x)(x \\cdot x \\cdot x)", "x^5"] },
    },
  },
  distributive: {
    en: {
      simple: "The number outside the parentheses visits every term inside. Nobody gets skipped.",
      hint: "Draw an arrow from the outside number to each term inside, and carry the signs with you.",
      example: { given: "-2(x - 5)", steps: ["(-2)(x) + (-2)(-5)", "-2x + 10"] },
    },
    fil: {
      simple: "Ang numero sa labas ay bumibisita sa bawat term sa loob. Walang naiiwan.",
      hint: "Gumuhit ng arrow mula sa numero sa labas papunta sa bawat term sa loob, kasama ang sign.",
      example: { given: "-2(x - 5)", steps: ["(-2)(x) + (-2)(-5)", "-2x + 10"] },
    },
  },
  frac_ops: {
    en: {
      simple: "You can only add fractions when the pieces are the same size. Make the bottoms match first.",
      hint: "Find a common denominator, rewrite both fractions, then add the tops only.",
      example: { given: "\\frac{1}{2} + \\frac{1}{3}", steps: ["\\frac{3}{6} + \\frac{2}{6}", "\\frac{5}{6}"] },
    },
    fil: {
      simple: "Puwede lang mag-add ng fractions kapag pareho ang laki ng piraso. Gawing pareho muna ang denominator.",
      hint: "Hanapin ang common denominator, isulat ulit ang dalawang fraction, tapos i-add ang numerator lang.",
      example: { given: "\\frac{1}{2} + \\frac{1}{3}", steps: ["\\frac{3}{6} + \\frac{2}{6}", "\\frac{5}{6}"] },
    },
  },
  sqrt_roots: {
    en: {
      simple: "$\\sqrt{49}$ asks: what number times itself is 49? In an equation like $x^2 = 49$, both $7$ and $-7$ work.",
      hint: "When you take the square root of both sides of an equation, write ± on one side.",
      example: { given: "x^2 = 49", steps: ["x = \\pm\\sqrt{49}", "x = 7 \\text{ or } x = -7"] },
    },
    fil: {
      simple: "Ang $\\sqrt{49}$ ay nagtatanong: anong numero, kapag mina-multiply sa sarili, ay 49? Sa $x^2 = 49$, puwede ang $7$ at $-7$.",
      hint: "Kapag kinuha ang square root ng magkabilang side ng equation, isulat ang ±.",
      example: { given: "x^2 = 49", steps: ["x = \\pm\\sqrt{49}", "x = 7 \\text{ o } x = -7"] },
    },
  },
  lin_eq: {
    en: {
      simple: "An equation is a balance. Whatever you do to one side, do to the other, until $x$ is alone.",
      hint: "Undo in reverse order: first undo adding or subtracting, then undo multiplying or dividing.",
      example: { given: "3x + 4 = 19", steps: ["3x = 15", "x = 5"] },
    },
    fil: {
      simple: "Ang equation ay parang timbangan. Kung ano ang gawin mo sa isang side, gawin din sa kabila, hanggang mag-isa ang $x$.",
      hint: "Baligtarin ang pagkakasunod: unahin ang pag-undo ng add o subtract, tapos ang multiply o divide.",
      example: { given: "3x + 4 = 19", steps: ["3x = 15", "x = 5"] },
    },
  },
  poly_mult: {
    en: {
      simple: "Every term in the first group multiplies every term in the second. Two terms times two terms makes four pieces.",
      hint: "Count your pieces: $(a+b)(c+d)$ gives 4 products before you combine like terms.",
      example: { given: "(x+2)(x+3)", steps: ["x \\cdot x + x \\cdot 3 + 2 \\cdot x + 2 \\cdot 3", "x^2 + 3x + 2x + 6", "x^2 + 5x + 6"] },
    },
    fil: {
      simple: "Bawat term sa unang grupo ay mina-multiply sa bawat term sa pangalawa. Dalawang term beses dalawang term ay apat na piraso.",
      hint: "Bilangin ang piraso: ang $(a+b)(c+d)$ ay may 4 na product bago pagsamahin ang like terms.",
      example: { given: "(x+2)(x+3)", steps: ["x \\cdot x + x \\cdot 3 + 2 \\cdot x + 2 \\cdot 3", "x^2 + 3x + 2x + 6", "x^2 + 5x + 6"] },
    },
  },
  special_products: {
    en: {
      simple: "$(a+b)^2$ is not $a^2 + b^2$. It's $(a+b)(a+b)$, and that has a middle piece: $2ab$.",
      hint: "Square the first term, double the product of both terms, square the last term.",
      example: { given: "(x+4)^2", steps: ["(x+4)(x+4)", "x^2 + 4x + 4x + 16", "x^2 + 8x + 16"] },
    },
    fil: {
      simple: "Ang $(a+b)^2$ ay hindi $a^2 + b^2$. Ito ay $(a+b)(a+b)$, at may gitnang piraso: $2ab$.",
      hint: "I-square ang una, doblehin ang product ng dalawa, i-square ang huli.",
      example: { given: "(x+4)^2", steps: ["(x+4)(x+4)", "x^2 + 4x + 4x + 16", "x^2 + 8x + 16"] },
    },
  },
  factoring: {
    en: {
      simple: "Factoring is multiplying backwards. Find two numbers that multiply to the last term and add to the middle one.",
      hint: "For $x^2 + bx + c$: list pairs that multiply to $c$, then pick the pair that adds to $b$.",
      example: { given: "x^2 + 5x + 6", steps: ["2 \\cdot 3 = 6,\\ \\ 2 + 3 = 5", "(x+2)(x+3)"] },
    },
    fil: {
      simple: "Ang factoring ay pag-multiply nang pabaligtad. Hanapin ang dalawang numero na ang product ay ang huling term at ang sum ay ang gitna.",
      hint: "Sa $x^2 + bx + c$: ilista ang mga pares na nagmu-multiply sa $c$, piliin ang pares na nag-a-add sa $b$.",
      example: { given: "x^2 + 5x + 6", steps: ["2 \\cdot 3 = 6,\\ \\ 2 + 3 = 5", "(x+2)(x+3)"] },
    },
  },
  rational_expr: {
    en: {
      simple: "A rational expression is a fraction with letters. Factor the top and bottom, then cancel matching factors.",
      hint: "You can only cancel something that is multiplied on both top and bottom, never a single added term.",
      example: { given: "\\frac{x^2-9}{x+3}", steps: ["\\frac{(x+3)(x-3)}{x+3}", "x - 3"] },
    },
    fil: {
      simple: "Ang rational expression ay fraction na may letters. I-factor ang itaas at ibaba, tapos i-cancel ang magkaparehong factor.",
      hint: "Puwede lang i-cancel ang naka-multiply sa itaas at ibaba, hindi ang term na naka-add.",
      example: { given: "\\frac{x^2-9}{x+3}", steps: ["\\frac{(x+3)(x-3)}{x+3}", "x - 3"] },
    },
  },
  quad_sqrt: {
    en: {
      simple: "Get the squared part alone, then take the square root of both sides. Don't forget ±.",
      hint: "If one side is already $(\\ldots)^2$, don't expand it. Take the square root right away.",
      example: { given: "(x-2)^2 = 16", steps: ["x - 2 = \\pm 4", "x = 6 \\text{ or } x = -2"] },
    },
    fil: {
      simple: "Ihiwalay ang naka-square na bahagi, tapos kunin ang square root ng magkabilang side. Huwag kalimutan ang ±.",
      hint: "Kung naka-$(\\ldots)^2$ na ang isang side, huwag nang i-expand. Kunin agad ang square root.",
      example: { given: "(x-2)^2 = 16", steps: ["x - 2 = \\pm 4", "x = 6 \\text{ o } x = -2"] },
    },
  },
  quad_factor: {
    en: {
      simple: "Make one side zero, factor the other side, then ask: what makes each factor zero?",
      hint: "If $A \\cdot B = 0$, then $A = 0$ or $B = 0$.",
      example: { given: "x^2 - 5x + 6 = 0", steps: ["(x-2)(x-3) = 0", "x = 2 \\text{ or } x = 3"] },
    },
    fil: {
      simple: "Gawing zero ang isang side, i-factor ang kabila, tapos itanong: ano ang nagpapa-zero sa bawat factor?",
      hint: "Kung $A \\cdot B = 0$, ibig sabihin $A = 0$ o $B = 0$.",
      example: { given: "x^2 - 5x + 6 = 0", steps: ["(x-2)(x-3) = 0", "x = 2 \\text{ o } x = 3"] },
    },
  },
  quad_formula: {
    en: {
      simple: "For $ax^2 + bx + c = 0$, the formula finds $x$ for you. Read off $a$, $b$ and $c$ carefully, signs included.",
      hint: "Work out $b^2 - 4ac$ first, on its own line.",
      example: { given: "x^2 + 4x + 3 = 0", steps: ["a = 1,\\ b = 4,\\ c = 3", "x = \\frac{-4 \\pm \\sqrt{16 - 12}}{2}", "x = \\frac{-4 \\pm 2}{2}", "x = -1 \\text{ or } x = -3"] },
    },
    fil: {
      simple: "Sa $ax^2 + bx + c = 0$, ang formula ang hahanap ng $x$. Basahin nang maingat ang $a$, $b$ at $c$, kasama ang sign.",
      hint: "Unahing kalkulahin ang $b^2 - 4ac$, sa sariling linya.",
      example: { given: "x^2 + 4x + 3 = 0", steps: ["a = 1,\\ b = 4,\\ c = 3", "x = \\frac{-4 \\pm \\sqrt{16 - 12}}{2}", "x = \\frac{-4 \\pm 2}{2}", "x = -1 \\text{ o } x = -3"] },
    },
  },
};

export function stuckHelp(skillId: string, lang: Lang): StuckHelp | null {
  return H[skillId]?.[lang] ?? null;
}
