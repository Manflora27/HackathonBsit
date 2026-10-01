# Deterministic verifiers beyond symbolic equivalence (Grades 1-12 Math, Physics, Chemistry)

Facts checked 2026-10-01 against `public/pyodide/pyodide-lock.json` (Pyodide ABI 2026_0, Python 3.14.2, emscripten 5.0.3) and PyPI JSON metadata. "Lock" = shipped in the local Pyodide, loadable with `loadPackage` and no network beyond our own host. "micropip" = pure-Python `py3-none-any` wheel installable from PyPI at runtime (needs network to pypi/files.pythonhosted.org unless we vendor the wheel into `public/pyodide/`; vendoring is recommended for offline/demo safety).

## Shipped in the lock (verified)
sympy 1.14.0, mpmath 1.4.1, numpy 2.4.6, scipy 1.18.0, uncertainties 3.2.3, shapely 2.1.2, pandas 3.0.2, statsmodels 0.14.6, networkx 3.6.1, unyt 3.1.0, astropy 7.2.0, gmpy2 2.3.0, regex, pyparsing 3.3.2, micropip 0.11.1, platformdirs, packaging, pyyaml, scikit-learn 1.8.0.
Not in lock: pint, chempy, periodictable, molmass, mendeleev, quantities, pyvalem, python-flint, antlr4 (needed for sympy `parse_latex`), flexcache, flexparser, pulp, sym.
Stdlib (always available): `fractions.Fraction`, `decimal.Decimal`, `statistics`, `math` (incl. `math.isclose`, `comb`, `perm`, `gcd`, `lcm`).

## 1. Units and physics quantities
| Library | License | Pyodide | Verifies | Notes |
|---|---|---|---|---|
| sympy.physics.units | BSD-3 | Lock (part of sympy) | Dimension check (`dimsys_SI.get_dimensional_dependencies`), unit conversion (`convert_to`), quantity arithmetic, SI prefixes, `Quantity` equality after conversion to base | Zero extra download. Weaker parsing: no string parser like "5 km/h"; we must write a small unit-token map. Tolerant to symbolic values, exact rationals. Best default. |
| unyt | BSD-3 | Lock (3.1.0; deps numpy, packaging, sympy all in lock) | Unit parsing from strings ("9.8 m/s**2"), `.to()`, `.units.dimensions` comparisons, numpy-array quantities, `unyt_array` equality with tolerance | Good string parsing; reasonable alternative to pint without any network. Pulls in numpy (already loaded for scipy). |
| pint 0.26.1 | BSD | micropip (pure wheel). Deps flexcache 0.3, flexparser 0.4 (pure BSD wheels), platformdirs (lock); typing-extensions (lock). Unverified in-browser: first-run builds a unit registry from its definitions file, ~1 s; disable cache. | Best parser ("km/h", "N*m", temperature offset units degC/degF), dimensionality check, `to_base_units`, `.check('[length]')` | Most widely trusted/known. Only choose over unyt if we need offset temperatures or its parser; otherwise extra supply-chain surface. |
| quantities (python-quantities) | BSD-3 | Not in lock; depends on numpy; likely pure-Python but I could not confirm the wheel via PyPI JSON | Same domain | Unmaintained-ish, skip. |
| astropy.units | BSD-3 | Lock (heavy, ~tens of MB) | Same, plus physical constants (CODATA) | Overkill; use only `scipy.constants` (BSD, in lock) for g, c, R, N_A, k_B etc. with CODATA values. |
| uncertainties | BSD-2 | Lock | Significant figures / error propagation (measurement uncertainty questions) | Sig-fig rules for "report to 3 s.f." are better done with `decimal` (below). |

Verifiable: unit conversion results, dimensional consistency of a student's formula (e.g. is v = d/t -> [L/T]), numeric answers with tolerance and unit equivalence (km/h vs m/s), kinematics/dynamics/energy/ohm's-law numeric answers (recompute by solving the governing equation in sympy with the problem givens), vector components (numpy), significant figures (rule-based, Decimal), scientific notation.
Approach for numeric physics: store each problem as `givens + target + formula` (author-time, human reviewed); the verifier solves with sympy, converts both answers to SI base via unyt/sympy.units, compares with relative tolerance (default 1% or sig-fig-aware). A bare number with a missing/incorrect unit is classified distinctly (right magnitude, wrong/missing unit) -- a gap-finding signal in itself.
Gaps (LLM only): conceptual/qualitative physics ("why does it slow down"), free-body-diagram quality, choosing the right model, sign conventions, graph interpretation without data, lab-design critique.

## 2. Chemistry
| Library | License | Pyodide | Verifies | Notes |
|---|---|---|---|---|
| Own code: SymPy/Fraction nullspace balancer | BSD (sympy) | Lock | Balanced equation check (`sum(coeff*atoms)` = 0 per element; trivial integer arithmetic) and balancing (`Matrix.nullspace()` -> clear denominators with lcm, smallest positive integers) | Fully deterministic, no dependency. Need a formula parser (regex `([A-Z][a-z]?)(\d*)`, parentheses via stack, hydrates "." and charges "^2+"). Charge conservation = an extra row. Recommended primary approach. |
| molmass 2026.8.15 | BSD-3 | micropip, pure wheel `py3-none-any`, no required dependencies (only optional Flask/pandas/wx). Best chemistry candidate to vendor. | Formula parsing (parentheses, hydrates, isotopes), molar mass, elemental composition (mass %), mass spectrum | Single small file with embedded element data. Cleanest for molar mass and percent composition. Not verified in-browser by me. |
| periodictable 2.1.0 | Public domain (explicit statement in metadata) | micropip, pure wheel; requires pyparsing (lock) and numpy (lock) | Element masses, `formula("H2O").mass`, atomic numbers, densities, isotopes | Public domain licence is the simplest to vendor. Overlaps molmass; pick one (molmass for formula parsing, or element table JSON, see below). |
| mendeleev 1.3.0 | MIT | Poor: requires SQLAlchemy (lock lists sqlalchemy), pandas, pint<0.25, pydantic, pydantic-core (Rust ext; check for lock presence), pyfiglet; ships SQLite DB | Rich element properties (electronegativity, configs) | Too heavy; skip. If we need electron configuration / electronegativity, embed a 118-row static JSON authored from IUPAC data instead. |
| chempy 0.10.2 | BSD-2 | Practically no: hard deps quantities, pyneqsys, pyodesys, sym, pulp, matplotlib, dot2tex (not in lock; several are not pure/need compilation) | `balance_stoichiometry`, equilibria, kinetics | Do not use in browser. Its balancing is also reproducible with the nullspace approach. |
| pyvalem | MIT-ish | Not checked; skip | State/formula parsing | skip |

Verifiable: balancing (check atoms + charge, accept any integer multiple only if it is the lowest-terms set; flag non-reduced), molar mass (tolerance ~0.01 g/mol, recommend 1% to allow rounded atomic masses 1.008 vs 1), mole/mass/particle conversions (N_A from scipy.constants), limiting reagent and theoretical/percent yield (balanced coefficients -> mole ratios, pure arithmetic with Fraction), mass percent composition, empirical formula (ratio of moles -> smallest integers), molarity/dilution (M1V1=M2V2), gas laws (PV=nRT with unit conversion, mixed units via unyt), pH/pOH/[H+] (log10 with tolerance), concentration conversions, simple thermochemistry (Hess's law = linear combination, sympy), significant figures.
Gaps (LLM only): predicting products ("what forms when X + Y"), naming/IUPAC nomenclature beyond a lookup table (ionic compounds can use a rule table; organic naming cannot), Lewis structures/VSEPR/hybridisation reasoning, mechanism arrows, reaction type classification (partly rule-based for simple cases), qualitative lab observations, equilibrium reasoning (Le Chatelier explanation), periodic-trend justification.
Element-data decision: for demo scope, one small embedded JSON (symbol, Z, standard atomic weight, from IUPAC/NIST, public domain data) plus our own formula parser avoids all dependencies; add molmass only if hydrates/isotopes needed.

## 3. Geometry
| Library | License | Pyodide | Verifies |
|---|---|---|---|
| sympy.geometry | BSD-3 | Lock | Exact Point/Segment/Line/Circle/Polygon/Triangle: area, perimeter, angle, intersection, similarity (`is_similar`), congruence, collinearity, centroid/circumcenter, tangent lines; exact surds (sqrt, pi) so "answer in terms of pi" compares exactly |
| shapely 2.1.2 | BSD-3 | Lock (wasm GEOS bundled in the wheel; geos itself not separately listed) | Planar polygon area/perimeter, unions, intersections, containment, distance; useful for coordinate-plane / composite-figure area; floating-point |
| Formula table + sympy | n/a | Lock | Solid geometry (volume, surface area of prisms, cylinders, cones, spheres) via a vetted table of formulas; Pythagorean/trig solve; law of sines/cosines; angle sums; arc length/sector; coordinate geometry (distance, midpoint, slope, line eq equivalence via `Eq` normalisation) |
Verifiable: any numeric or exact answer given the figure's data. Transformations (reflection/rotation/translation of a point) via sympy matrices. Proof validity is not verifiable here.
Gaps: figure-dependent questions where the diagram is an image (need structured figure spec with each item; we should store figure data as JSON: points/lengths), naming/classifying shapes from drawings, two-column and paragraph proofs, construction steps, "explain why", geometric reasoning with justifications. Automated theorem provers exist (e.g. GeoGebra Discovery/Geometry Prover), but are not lightweight or permissive for browser embed; treat proofs as LLM + rubric.

## 4. Statistics and probability
| Tool | License | Pyodide | Verifies |
|---|---|---|---|
| `statistics` + `fractions` (stdlib) | PSF | yes | mean, median, mode/multimode, pstdev/stdev, quartiles (note `statistics.quantiles` methods differ: textbook IQR needs an explicit method; fix the convention per problem and store it), range |
| `math.comb/perm/factorial` | PSF | yes | Counting, permutations, combinations, with exact integers |
| sympy.stats / sympy.combinatorics | BSD-3 | Lock | Exact discrete probability (dice, cards, independent events), expectation, variance, conditional probability via enumeration of a finite sample space (brute force with Fractions is often simpler and bulletproof) |
| scipy.stats | BSD-3 | Lock | Normal/binomial/t distributions, p-values, z-scores, confidence intervals, correlation, linear regression (`linregress`) |
| statsmodels | BSD-3 | Lock (heavy) | Only if we need regression diagnostics; likely unnecessary |
| pandas | BSD-3 | Lock (heavy) | Not needed |
Verifiable: all descriptive stats, probability values (as exact fractions; accept equivalent fraction/decimal/percent), binomial/normal calculations, regression coefficients, z/t computations, combinatorics, expected value.
Gaps: choosing the appropriate test, interpreting results in context, checking assumptions, bias/sampling-design critique, evaluating misleading graphs, writing conclusions in context, and data-display tasks (histogram/box plot drawings from a canvas -- partially checkable if we capture the plotted values).

## 5. Arithmetic, fractions, decimals, percent, ratio (Grades 1-6)
| Tool | License | Pyodide | Verifies |
|---|---|---|---|
| `fractions.Fraction` | PSF | yes (stdlib) | Exact fractions, mixed numbers (custom parse "2 1/3"), equivalence, ordering, +-*/, simplification; reduced-form check `Fraction(n,d)` vs the student's literal n/d (the answer is "equal" but "not simplified": a critical gap signal) |
| `decimal.Decimal` | PSF | yes | Exact decimal arithmetic (no 0.1+0.2 issues), rounding to place value (`quantize`), significant figures, place-value decomposition |
| `int` | PSF | yes | Long division with remainder, multiplication algorithms, divisibility, GCD/LCM, primes, factor trees, order of operations |
| sympy `Rational`/`nsimplify`/`sympify` | BSD-3 | Lock | Parsing strings into exact rationals; `Rational('0.25')` exact; percent via `/100` |
Verifiable: all arithmetic (including multi-step), percent (of, increase/decrease, discount, tax), ratios and unit rates (equality by cross-multiplication, `Fraction`), proportion solving, rounding and estimation (rule-based with expected round-to), place value, comparing/ordering numbers, number-line positions (numeric), divisibility, factors/multiples, integers and signed numbers, exponents, scientific notation, simple order-of-operations, equivalent expressions. Error diagnosis is the value: re-run candidate misconception procedures (add numerators and denominators, forget to carry, subtract smaller from larger, ignore sign, wrong decimal alignment, percent as decimal) and see which one reproduces the wrong answer. This is deterministic and powers "find the gap" without an LLM.
Gaps: reading handwritten work and drawings (needs vision), explanations of why a method works, number talk strategies, conceptual models (area model, bar model, tape diagram) beyond the numeric result.

## 6. Word problems
No library "solves" arbitrary word problems deterministically. Approaches:
1. Pre-authored structure (recommended). The problem bank stores `quantities` (named numeric slots), `relationship` (equation(s)/formula in SymPy), and `target`. The verifier solves it, compares to the student's numeric answer, and also checks units. Parameterised templates with randomised numbers (seeded) produce unlimited variants and let us diagnose via misconception operations (picked wrong operation, used the wrong quantity).
2. Student-confirmed equation (extract-then-solve). Student writes (or picks) an equation/expression for the situation ("let x = ..., 3x+5=20"); sympy checks (a) it is equivalent to the reference equation up to rearrangement and scaling (`solve` both for the unknown, or compare `lhs-rhs` ratios), (b) it solves to the reference answer. This verifies modelling, not just answers, deterministically. An LLM may propose an equation from the text, but the student must confirm it and the truth always comes from the authored reference, never from LLM output.
3. Constrained-NLP extraction (numbers/units regex, keyword->operation cues) only as a hint, never as a verdict; known to be unreliable. Datasets like GSM8K/MAWPS/SVAMP (MIT/CC) can supply test cases to evaluate, not to run.
4. Answer-only check with LLM-generated solution code is "LLM + executed Python"; useful but not a deterministic ground truth. If used, require two independent LLM solutions to agree with the authored key before storing.
Gaps (LLM only): interpreting a free-text problem not in the bank, judging the reasonableness of a student's written justification, identifying which info is irrelevant (can be authored as metadata for bank problems), cultural/context language support (Filipino/English code-switching), partial credit for incomplete reasoning.

## 7. Number sense and measurement
| Tool | Pyodide | Verifies |
|---|---|---|
| Fraction/Decimal/int | yes | Place value, rounding, estimation windows (accept range), comparing/ordering, skip counting, number patterns (sequence next terms; sympy `sequence`/`rsolve`; polynomial-fit check for pattern rules), odd/even, factors |
| sympy.physics.units / unyt | yes | Measurement conversion (length, mass, capacity, time, temperature, area, volume), choosing reasonable unit (rule-based on magnitude windows) |
| `datetime`/`calendar` | yes | Time/elapsed time, calendar, clock reading (angle between hands via arithmetic) |
| Money | Decimal | Currency totals, change, discounts |
| Rule tables (authored) | n/a | Which unit to measure with (cm vs m), benchmark estimates, "about how much" with tolerance range |
Gaps: reading measuring-tool images (ruler/protractor/scale) without structured data, estimation explanations, number-line drawings (checkable if captured as coordinates), reasonableness narratives.

## Recommended verifier per domain
| Domain / skill | Primary verifier (deterministic) | Package source | Fallback |
|---|---|---|---|
| Grades 1-6 arithmetic, place value, rounding | `int`, `Fraction`, `Decimal` + misconception-replay catalogue | stdlib | -- |
| Fractions, decimals, percent, ratio, proportion | `Fraction`/`Decimal`/sympy `Rational`; equivalence + "simplest form" check | stdlib + sympy (lock) | -- |
| Algebra, functions, calculus, trig (G7-12) | Existing engine/gapfinder.py (sympy equivalence, `Eq` solve, numeric sampling) | lock | LLM for steps |
| Geometry (planar, solid, coordinate, trig) | sympy.geometry + formula table; shapely for composite polygons | lock | LLM for proofs/diagrams |
| Statistics/probability | `statistics`, `math.comb`, `Fraction`, scipy.stats; brute-force sample space | stdlib + lock | LLM for interpretation |
| Sequences/patterns/number theory | sympy (`sequence`, `rsolve`, `factorint`, `gcd`), stdlib | lock | -- |
| Measurement and unit conversion | sympy.physics.units or unyt (string parsing) | lock | pint via vendored wheel if offset temps needed |
| Physics numeric problems | authored formula + sympy solve + unyt/sympy units + `scipy.constants`; dimension check of student formula | lock | LLM for concepts |
| Significant figures / scientific notation | `Decimal` rule-based checker | stdlib | -- |
| Chemistry: balancing, stoichiometry, mole, molarity, gas laws, pH | Own formula parser + SymPy/Fraction nullspace balancer + embedded element table (optionally molmass or periodictable vendored) | stdlib + lock | LLM for qualitative |
| Chemistry: molar mass, % composition, empirical formula | molmass (vendor wheel) or own parser + table | micropip/vendor | -- |
| Word problems | Authored templates (quantities + equation) + student-confirmed equation checked by sympy | lock | LLM extraction as suggestion only |

Operational notes: (a) vendor any micropip wheels under `public/pyodide/` and install from that URL so no runtime dependence on PyPI; (b) run each verification with a timeout and a `Fraction`/`Rational` path first, floats second; (c) tolerance policy must be per-item metadata (exact / abs / rel / sig-figs); (d) the lock's Python is 3.14, so wheels must not rely on removed stdlib; pure `py3-none-any` wheels are fine.

## Skill types that remain LLM-only (or LLM plus rubric)
- Proofs and justification (geometry, algebra, number theory), "explain your reasoning", error-explanation text.
- Free-text word problems outside the authored bank; deciding relevance/irrelevance of info; interpretation in context (stats conclusions, slope meaning, "does the answer make sense").
- Conceptual physics and chemistry explanation (why/how, model selection, qualitative prediction, Le Chatelier, periodic trends, bonding/VSEPR/Lewis, reaction product prediction, organic nomenclature/mechanisms, lab design and error analysis).
- Diagram, graph and drawing interpretation or construction (unless the figure is captured as structured data).
- Handwritten work recognition (vision), multi-step work-shown grading for partial credit.
- Language-dependent items (reading comprehension in math, Filipino/English mixing, vocabulary).
- Modelling choices, estimation reasoning, strategy selection, creativity/open-ended tasks, data-collection/sampling critique.
Mitigation: even for these, store a rubric as a checklist of authored atomic claims and have the LLM only mark each claim present/absent, never decide correctness from scratch; keep LLM verdicts labelled lower-confidence in the UI.
