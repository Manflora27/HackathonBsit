"""Gap Finder engine: step-by-step verification and buggy-rule diagnosis.

Pure Python + SymPy. Runs under pytest, in the browser via Pyodide, and
behind an HTTP endpoint if needed. The single entry point for other
languages is `run(json_str) -> json_str`.

Correctness is decided here, never by the AI.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from sympy import (
    Abs,
    Add,
    Eq,
    FiniteSet,
    Integer,
    Mul,
    Pow,
    Rational,
    S,
    Symbol,
    cancel,
    expand,
    latex,
    preorder_traversal,
    solveset,
    sqrt,
    together,
)
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
LOCALS = {c: Symbol(c) for c in "abcdfghjkmnpqrstuvwxyz"}
LOCALS["sqrt"] = sqrt


class ParseError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def normalize(text: str) -> str:
    s = text.strip()
    s = (
        s.replace("−", "-")
        .replace("–", "-")
        .replace("×", "*")
        .replace("·", "*")
        .replace("÷", "/")
        .replace("²", "^2")
        .replace("³", "^3")
        .replace("+-", "±")
        .replace("+/-", "±")
    )
    s = re.sub(r"√\s*\(", "sqrt(", s)
    s = re.sub(r"√\s*([0-9a-z]+)", r"sqrt(\1)", s)
    s = s.lstrip("= ").strip()
    # Make a negated group explicit so the unevaluated tree keeps Mul(-1, Add).
    s = re.sub(r"(^|[=(])\s*-\s*\(", r"\1-1*(", s)
    return s


def _parse_side(s: str, evaluate: bool):
    if not s.strip():
        raise ParseError("empty side")
    try:
        return parse_expr(s, local_dict=dict(LOCALS), transformations=TRANSFORMS, evaluate=evaluate)
    except Exception as exc:  # noqa: BLE001 - surface as a plain parse error
        raise ParseError(str(exc)) from exc


@dataclass
class Step:
    """A parsed line: either one expression, or a disjunction of equations."""

    text: str
    expr: object = None  # set when the line has no '='
    eqs: list = field(default_factory=list)  # list[(lhs, rhs)] evaluated
    raw_eqs: list = field(default_factory=list)  # same, unevaluated

    @property
    def is_eq(self) -> bool:
        return bool(self.eqs)

    def symbols(self):
        out = set()
        if self.expr is not None:
            out |= self.expr.free_symbols
        for l, r in self.eqs:
            out |= l.free_symbols | r.free_symbols
        return out

    def to_latex(self) -> str:
        if self.expr is not None:
            return latex(self.raw_expr)
        parts = [f"{latex(l)} = {latex(r)}" for l, r in self.raw_eqs]
        return r" \quad\text{or}\quad ".join(parts)


def parse_step(text: str) -> Step:
    s = normalize(text)
    if not s:
        raise ParseError("empty line")
    chunks = [c.strip() for c in re.split(r"\bor\b|,|;", s) if c.strip()]
    if len(chunks) > 1 and not all("=" in c for c in chunks):
        chunks = [s]
    step = Step(text=text)
    if len(chunks) == 1 and "=" not in chunks[0]:
        step.expr = _parse_side(chunks[0], True)
        step.raw_expr = _parse_side(chunks[0], False)
        return step
    for chunk in chunks:
        variants = [chunk.replace("±", "+"), chunk.replace("±", "-")] if "±" in chunk else [chunk]
        for v in variants:
            sides = v.split("=")
            if len(sides) != 2:
                raise ParseError("each part needs exactly one '='")
            l, r = sides
            step.eqs.append((_parse_side(l, True), _parse_side(r, True)))
            step.raw_eqs.append((_parse_side(l, False), _parse_side(r, False)))
    return step


# ---------------------------------------------------------------------------
# Equivalence
# ---------------------------------------------------------------------------


def _is_zero(e):
    """True / False / None (unknown)."""
    try:
        d = cancel(together(expand(e)))
        if d == 0:
            return True
        r = d.equals(0)
        return r
    except Exception:  # noqa: BLE001
        return None


def solution_set(step: Step, var):
    out = S.EmptySet
    for l, r in step.eqs:
        try:
            sol = solveset(l - r, var, S.Reals)
        except Exception:  # noqa: BLE001
            return None
        if not (isinstance(sol, FiniteSet) or sol in (S.EmptySet, S.Reals)):
            return None
        out = out.union(sol)
    return out


def _sets_equal(a, b):
    if a == b:
        return True
    if isinstance(a, FiniteSet) and isinstance(b, FiniteSet) and len(a) == len(b):
        rest = list(b)
        for x in a:
            match = next((y for y in rest if _is_zero(x - y)), None)
            if match is None:
                return False
            rest.remove(match)
        return True
    return False


def equivalent(a: Step, b: Step, var=None):
    """True / False / None (couldn't verify)."""
    if a.expr is not None and b.expr is not None:
        return _is_zero(a.expr - b.expr)
    if a.is_eq and b.is_eq:
        syms = a.symbols() | b.symbols()
        if var is None and len(syms) == 1:
            var = next(iter(syms))
        if var is not None and syms <= {var}:
            sa, sb = solution_set(a, var), solution_set(b, var)
            if sa is None or sb is None:
                return None
            return _sets_equal(sa, sb)
        # Several variables: single equations must be nonzero constant multiples.
        if len(a.eqs) == 1 and len(b.eqs) == 1:
            pa = expand(a.eqs[0][0] - a.eqs[0][1])
            pb = expand(b.eqs[0][0] - b.eqs[0][1])
            if pb == 0 or pa == 0:
                return pa == pb
            ratio = cancel(pa / pb)
            return bool(ratio.is_number and ratio != 0)
        return None
    return None


def is_solved_form(step: Step, var) -> bool:
    if not step.is_eq:
        return False
    for l, r in step.eqs:
        if not ((l == var and r.is_number) or (r == var and l.is_number)):
            return False
    return True


# ---------------------------------------------------------------------------
# Buggy rules: apply a known WRONG operation to the previous line. If the
# result is equivalent to the student's line, the misconception is certain.
# Each rule yields (buggy_step_text_relation, correct_relation).
# A relation is ("expr", e) or ("eq", [(l, r), ...]).
# ---------------------------------------------------------------------------


def _relation(step: Step, raw=True):
    if step.expr is not None:
        return ("expr", step.raw_expr if raw else step.expr)
    return ("eq", list(step.raw_eqs if raw else step.eqs))


def _replace_in_relation(rel, old, new):
    kind, val = rel
    if kind == "expr":
        return ("expr", val.xreplace({old: new}))
    return ("eq", [(l.xreplace({old: new}), r.xreplace({old: new})) for l, r in val])


def _relation_nodes(rel):
    kind, val = rel
    roots = [val] if kind == "expr" else [s for pair in val for s in pair]
    for root in roots:
        yield from preorder_traversal(root)


def _flat_factors(m):
    out = []
    for a in m.args:
        if isinstance(a, Mul):
            out.extend(_flat_factors(a))
        else:
            out.append(a)
    return out


def rule_binomial_square(rel, var):
    for node in _relation_nodes(rel):
        if isinstance(node, Pow) and node.exp == 2 and isinstance(node.base, Add):
            terms = [expand(t) for t in node.base.args]
            correct = expand(node.base**2)
            lost_sign = Add(*[t**2 for t in terms])
            kept_sign = Add(*[(-(t**2) if t.could_extract_minus_sign() else t**2) for t in terms])
            for bug in {lost_sign, kept_sign}:
                yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, correct)


def _distribution_nodes(rel):
    for node in _relation_nodes(rel):
        if isinstance(node, Mul):
            factors = _flat_factors(node)
            adds = [f for f in factors if isinstance(f, Add)]
            if len(adds) == 1:
                coeff = Mul(*[f for f in factors if f is not adds[0]])
                if coeff != 1:
                    yield node, coeff, [expand(t) for t in adds[0].args]


def rule_partial_distribution(rel, var):
    for node, coeff, terms in _distribution_nodes(rel):
        bug = expand(coeff * terms[0]) + Add(*terms[1:])
        yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, expand(coeff * Add(*terms)))


def rule_negative_distribution(rel, var):
    for node, coeff, terms in _distribution_nodes(rel):
        if coeff.is_number and coeff.is_negative:
            bug = expand(coeff * terms[0]) + Add(*[expand(-coeff * t) for t in terms[1:]])
            yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, expand(coeff * Add(*terms)))


def _eq_rel(rel):
    return rel[0] == "eq" and len(rel[1]) == 1


def rule_sign_not_changed(rel, var):
    if not _eq_rel(rel):
        return
    (l, r) = rel[1][0]
    for side in (0, 1):
        src, dst = (l, r) if side == 0 else (r, l)
        terms = Add.make_args(src)
        if len(terms) < 2:
            continue
        for t in terms:
            rest = Add(*[x for x in terms if x is not t])
            bug_dst, ok_dst = Add(dst, t), Add(dst, -t)
            if side == 0:
                yield ("eq", [(rest, bug_dst)]), ("eq", [(rest, ok_dst)])
            else:
                yield ("eq", [(bug_dst, rest)]), ("eq", [(ok_dst, rest)])


def _numeric_coeffs(e):
    out = set()
    for t in Add.make_args(expand(e)):
        c, _ = t.as_coeff_Mul()
        if c.is_Integer and abs(c) > 1:
            out.add(abs(c))
    return out


def rule_divide_one_side_or_term(rel, var):
    if not _eq_rel(rel) or var is None:
        return
    (l, r) = rel[1][0]
    l, r = expand(l), expand(r)
    for d in _numeric_coeffs(l) | _numeric_coeffs(r):
        correct = ("eq", [(expand(l / d), expand(r / d))])
        # divided only the variable terms
        partial_l = Add(*[t / d if t.has(var) else t for t in Add.make_args(l)])
        yield ("eq", [(partial_l, expand(r / d))]), correct
        # divided only one side
        yield ("eq", [(expand(l / d), r)]), correct


def rule_subtract_coefficient(rel, var):
    if not _eq_rel(rel) or var is None:
        return
    (l, r) = rel[1][0]
    l, r = expand(l), expand(r)
    c, rest = l.as_coeff_Mul()
    if rest == var and c not in (0, 1):
        yield ("eq", [(var, r - c)]), ("eq", [(var, r / c)])


def rule_combine_unlike(rel, var):
    if var is None:
        return
    for node in _relation_nodes(rel):
        if isinstance(node, Add):
            terms = [expand(t) for t in node.args]
            var_terms = [t for t in terms if t.has(var)]
            consts = [t for t in terms if t.is_number]
            if var_terms and consts and all(t.as_coeff_Mul()[1] == var for t in var_terms):
                total = sum(t.as_coeff_Mul()[0] for t in var_terms) + sum(consts)
                yield _replace_in_relation(rel, node, total * var), rel


def rule_fraction_add_across(rel, var):
    for node in _relation_nodes(rel):
        if isinstance(node, Add):
            parts = []
            for t in node.args:
                n, d = expand(t).as_numer_denom()
                if d.is_Integer and d > 1:
                    parts.append((t, n, d))
            for i in range(len(parts)):
                for j in range(i + 1, len(parts)):
                    (t1, n1, d1), (t2, n2, d2) = parts[i], parts[j]
                    others = [a for a in node.args if a is not t1 and a is not t2]
                    bug = Add(*others, (n1 + n2) / (d1 + d2))
                    yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, expand(node))


def rule_like_terms_multiply(rel, var):
    """2x + 3x -> 5x^2: combined coefficients but also multiplied the variable."""
    if var is None:
        return
    for node in _relation_nodes(rel):
        if isinstance(node, Add):
            terms = [expand(t) for t in node.args]
            groups = {}
            for t in terms:
                c, base = t.as_coeff_Mul()
                if base.has(var):
                    groups.setdefault(base, []).append(c)
            for base, coeffs in groups.items():
                if len(coeffs) > 1:
                    others = [t for t in terms if t.as_coeff_Mul()[1] != base]
                    bug = Add(*others, sum(coeffs) * base ** len(coeffs))
                    yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, expand(node))


def rule_sqrt_of_sum(rel, var):
    for node in _relation_nodes(rel):
        if isinstance(node, Pow) and node.exp == Rational(1, 2) and isinstance(node.base, Add):
            # Students treat sqrt(x^2) as x, so the bug does too.
            bug = Add(*[t.base if isinstance(t, Pow) and t.exp == 2 else sqrt(t) for t in node.base.args])
            yield _replace_in_relation(rel, node, bug), rel


def rule_exponent_product(rel, var):
    for node in _relation_nodes(rel):
        if isinstance(node, Mul):
            pows = [a for a in node.args if isinstance(a, Pow)]
            for i in range(len(pows)):
                for j in range(i + 1, len(pows)):
                    a, b = pows[i], pows[j]
                    if a.base == b.base:
                        others = [x for x in node.args if x is not a and x is not b]
                        bug = Mul(*others, a.base ** (a.exp * b.exp))
                        ok = Mul(*others, a.base ** (a.exp + b.exp))
                        yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, ok)
        if isinstance(node, Pow) and isinstance(node.base, Pow):
            bug = node.base.base ** (node.base.exp + node.exp)
            ok = node.base.base ** (node.base.exp * node.exp)
            yield _replace_in_relation(rel, node, bug), _replace_in_relation(rel, node, ok)


def rule_sqrt_as_halving(rel, var):
    if not _eq_rel(rel) or var is None:
        return
    (l, r) = rel[1][0]
    l, r = expand(l), expand(r)
    if l == var**2 and r.is_number:
        yield ("eq", [(var, r / 2)]), ("eq", [(var, sqrt(r)), (var, -sqrt(r))])


RULES = [
    ("binomial_square", rule_binomial_square),
    ("negative_distribution", rule_negative_distribution),
    ("partial_distribution", rule_partial_distribution),
    ("sign_not_changed", rule_sign_not_changed),
    ("divide_one_side_or_term", rule_divide_one_side_or_term),
    ("subtract_coefficient", rule_subtract_coefficient),
    ("fraction_add_across", rule_fraction_add_across),
    ("combine_unlike_terms", rule_combine_unlike),
    ("like_terms_multiply", rule_like_terms_multiply),
    ("sqrt_of_sum", rule_sqrt_of_sum),
    ("exponent_rules", rule_exponent_product),
    ("sqrt_as_halving", rule_sqrt_as_halving),
]


def _step_from_relation(rel) -> Step:
    kind, val = rel
    st = Step(text="")
    if kind == "expr":
        st.expr = _parse_side(str(val), True)
        st.raw_expr = val
    else:
        for l, r in val:
            st.eqs.append((_parse_side(str(l), True), _parse_side(str(r), True)))
            st.raw_eqs.append((l, r))
    return st


def _set_rule(prev: Step, cur: Step, var):
    """Lost-solution misconceptions, decided by comparing solution sets."""
    if var is None or not prev.is_eq or not cur.is_eq:
        return None
    sp, sc = solution_set(prev, var), solution_set(cur, var)
    if not (isinstance(sp, FiniteSet) and isinstance(sc, FiniteSet)) or len(sc) == 0:
        return None
    if not sc.is_subset(sp) or sc == sp:
        return None
    missing = sp - sc
    if any(m == 0 for m in missing) and len(prev.eqs) == 1:
        l, r = prev.eqs[0]
        if l.has(var) and r.has(var):
            return "divided_by_variable", missing
    if all(any(_is_zero(m + x) for x in sc) for m in missing):
        return "missing_negative_root", missing
    if len(prev.raw_eqs) == 1 and any(
        isinstance(side, Pow) and side.exp == 2 for side in prev.raw_eqs[0]
    ):
        return "missing_negative_root", missing
    return "lost_solution", missing


def classify(prev: Step, cur: Step, var):
    set_hit = _set_rule(prev, cur, var)
    if set_hit:
        mid, missing = set_hit
        return {
            "id": mid,
            "confidence": 1.0,
            "source": "rule",
            "wrongTerms": {"missing": [latex(m) for m in missing], "extra": []},
            "expectedLatex": None,
        }
    rel = _relation(prev)
    for mid, rule in RULES:
        try:
            for bug_rel, ok_rel in rule(rel, var):
                try:
                    bug_step = _step_from_relation(bug_rel)
                except ParseError:
                    continue
                if equivalent(bug_step, cur, var) is True:
                    ok_step = _step_from_relation(ok_rel)
                    return {
                        "id": mid,
                        "confidence": 1.0,
                        "source": "rule",
                        "wrongTerms": term_diff(ok_step, bug_step),
                        "expectedLatex": highlighted_latex(ok_step, term_diff(ok_step, bug_step)["missing_exprs"]),
                    }
        except Exception:  # noqa: BLE001 - a broken rule must never break a diagnosis
            continue
    return None


# ---------------------------------------------------------------------------
# Term diff + highlighted LaTeX ("circle the wrong term")
# ---------------------------------------------------------------------------


def _side_terms(step: Step):
    if step.expr is not None:
        return [Add.make_args(expand(step.expr))]
    out = []
    for l, r in step.eqs:
        out.append(Add.make_args(expand(l)))
        out.append(Add.make_args(expand(r)))
    return out


def term_diff(correct: Step, student: Step):
    missing, extra = [], []
    for c_terms, s_terms in zip(_side_terms(correct), _side_terms(student)):
        c_set, s_set = set(c_terms), set(s_terms)
        missing += [t for t in c_terms if t not in s_set and t != 0]
        extra += [t for t in s_terms if t not in c_set and t != 0]
    return {
        "missing": [latex(t) for t in missing],
        "extra": [latex(t) for t in extra],
        "missing_exprs": missing,
        "extra_exprs": extra,
    }


def _degree(t):
    try:
        return sum(t.as_powers_dict()[s] for s in t.free_symbols)
    except Exception:  # noqa: BLE001
        return 0


def _terms_latex(e, highlight):
    terms = Add.make_args(e) if isinstance(e, Add) else (e,)
    ordered = sorted(terms, key=_degree, reverse=True) if isinstance(e, Add) else list(terms)
    out = ""
    for i, t in enumerate(ordered):
        neg = t.could_extract_minus_sign()
        body = latex(-t if neg else t)
        if t in highlight:
            body = r"\htmlClass{gf-mark}{" + body + "}"
        if i == 0:
            out += ("-" if neg else "") + body
        else:
            out += (" - " if neg else " + ") + body
    return out


def highlighted_latex(step: Step, highlight) -> str:
    hl = set(highlight)
    if step.expr is not None:
        return _terms_latex(expand(step.expr), hl)
    return r" \quad\text{or}\quad ".join(
        f"{_terms_latex(expand(l), hl)} = {_terms_latex(expand(r), hl)}" for l, r in step.eqs
    )


# ---------------------------------------------------------------------------
# Public operations
# ---------------------------------------------------------------------------


def _main_var(*steps):
    syms = set()
    for s in steps:
        syms |= s.symbols()
    return next(iter(syms)) if len(syms) == 1 else None


def analyze(problem: str, steps: list[str], kind: str = "solve") -> dict:
    """Check each step against the previous one; diagnose the first bad one."""
    out = {"problemLatex": None, "steps": [], "errorIndex": None, "misconception": None,
           "wrongTerms": None, "expectedLatex": None, "studentLatex": None, "complete": False}
    try:
        given = parse_step(problem)
    except ParseError as exc:
        out["error"] = f"problem could not be parsed: {exc}"
        return out
    out["problemLatex"] = given.to_latex()

    parsed = []
    for i, text in enumerate(steps):
        try:
            st = parse_step(text)
            parsed.append(st)
            out["steps"].append({"input": text, "latex": st.to_latex(), "status": "pending"})
        except ParseError:
            parsed.append(None)
            out["steps"].append({"input": text, "latex": None, "status": "unparsed"})

    var = _main_var(given, *[p for p in parsed if p is not None])
    prev = given
    for i, st in enumerate(parsed):
        if st is None:
            if out["errorIndex"] is None:
                out["errorIndex"] = i
            break
        verdict = equivalent(prev, st, var)
        if verdict is True:
            out["steps"][i]["status"] = "ok"
            prev = st
            continue
        if verdict is None:
            out["steps"][i]["status"] = "unverifiable"
            prev = st
            continue
        out["steps"][i]["status"] = "error"
        out["errorIndex"] = i
        hit = classify(prev, st, var)
        if hit:
            out["misconception"] = {k: hit[k] for k in ("id", "confidence", "source")}
            out["wrongTerms"] = {"missing": hit["wrongTerms"]["missing"], "extra": hit["wrongTerms"]["extra"]}
            out["expectedLatex"] = hit["expectedLatex"]
            extra = hit["wrongTerms"].get("extra_exprs") or []
            out["studentLatex"] = highlighted_latex(st, extra) if extra else st.to_latex()
        else:
            diff = term_diff(prev, st)
            out["wrongTerms"] = {"missing": diff["missing"], "extra": diff["extra"]}
            out["studentLatex"] = highlighted_latex(st, diff["extra_exprs"])
        out["previousLatex"] = prev.to_latex()
        break

    for s in out["steps"]:
        if s["status"] == "pending":
            s["status"] = "skipped"

    if out["errorIndex"] is None and parsed and parsed[-1] is not None:
        last = parsed[-1]
        if kind == "solve":
            out["complete"] = var is not None and is_solved_form(last, var)
        else:
            out["complete"] = True
    return out


def check_answer(expected: str, answer: str, form: str = "any") -> dict:
    """Is a short answer equivalent to the key (and in the requested form)?"""
    try:
        e, a = parse_step(expected), parse_step(answer)
    except ParseError:
        return {"correct": False, "reason": "unparsed"}
    eq = equivalent(e, a)
    if eq is not True:
        return {"correct": False, "reason": "not_equivalent" if eq is False else "unverifiable", "latex": a.to_latex()}
    if form == "expanded" and a.expr is not None and a.expr != expand(a.expr):
        return {"correct": False, "reason": "not_expanded", "latex": a.to_latex()}
    if form == "factored" and a.expr is not None and not (isinstance(a.expr, (Mul, Pow)) and a.expr != expand(a.expr)):
        return {"correct": False, "reason": "not_factored", "latex": a.to_latex()}
    if form == "solved" and not is_solved_form(a, _main_var(a)):
        return {"correct": False, "reason": "not_solved", "latex": a.to_latex()}
    return {"correct": True, "latex": a.to_latex()}


def preview(text: str) -> dict:
    """Parse one line and return LaTeX for the 'Is this what you wrote?' check."""
    try:
        return {"ok": True, "latex": parse_step(text).to_latex()}
    except ParseError as exc:
        return {"ok": False, "error": str(exc)}


def solve_key(problem: str) -> dict:
    """Build an answer key with SymPy (used to verify AI-generated practice)."""
    st = parse_step(problem)
    var = _main_var(st)
    if st.is_eq and var is not None:
        sol = solution_set(st, var)
        if isinstance(sol, FiniteSet):
            return {"ok": True, "solutions": [latex(s) for s in sol],
                    "answer": " or ".join(f"{var} = {s}" for s in sol)}
        return {"ok": False}
    if st.expr is not None:
        return {"ok": True, "answer": str(expand(st.expr)), "latex": latex(expand(st.expr))}
    return {"ok": False}


def run(payload: str) -> str:
    req = json.loads(payload)
    op = req.get("op")
    try:
        if op == "analyze":
            res = analyze(req["problem"], req["steps"], req.get("kind", "solve"))
        elif op == "check":
            res = check_answer(req["expected"], req["answer"], req.get("form", "any"))
        elif op == "preview":
            res = preview(req["text"])
        elif op == "solve":
            res = solve_key(req["problem"])
        else:
            res = {"error": f"unknown op {op}"}
    except Exception as exc:  # noqa: BLE001 - never crash the caller
        res = {"error": f"engine error: {exc}"}
    return json.dumps(res)
