"""
Extract the numbered learning competencies from the MATATAG curriculum guides (Aug 2023).

    pdftotext -layout MATATAG-Mathematics-1-10.pdf math.txt
    pdftotext -layout MATATAG-Science-3-10.pdf sci.txt
    python3 scripts/extract-matatag-competencies.py math.txt sci.txt > /tmp/competencies-raw.json

Sources (see docs/research/deped-curriculum-sources.md):
  Math 1-10:    https://matatagcurriculum.com/wp-content/uploads/2024/11/MATATAG-Curriculum-Grade-1-10-Maths.pdf
  Science 3-10: https://eduksama.com/wp-content/uploads/2024/10/FINAL-MATATAG-Science-CG-2023-Grades-3-10.pdf

Each quarter table has a banner (GRADE 7 – QUARTER 1), then Content | Content Standards | Learning Competencies
columns. Competencies are numbered 1..N per quarter; DepEd publishes no codes for them. The numbers are found
near the third column's left edge (they drift a few characters), so wrapped middle-column text can't start one.
Math rows also carry their content domain (NA/MG/DP) in the first column.
Then `npx tsx scripts/map-competencies.ts /tmp/competencies-raw.json` assigns each one to a plan unit.
"""
import json, re, sys, unicodedata


def math_competencies(txt):
    out = {}
    banner = re.compile(r'GRADE (\d+) – QUARTER (\d)')
    i = 0
    while i < len(txt):
        m = banner.search(txt[i])
        if not m: i += 1; continue
        g, q = int(m.group(1)), int(m.group(2))
        # header: find the line with two "The learners"
        j = i + 1
        col = None
        while j < i + 6:
            idx = [k.start() for k in re.finditer(r'The learners', txt[j])]
            if len(idx) >= 2: col = idx[1] - 2; break
            j += 1
        if col is None: print('no header', g, q, file=sys.stderr); i += 1; continue
        comps, dom = [], None
        j += 1
        while j < len(txt) and not txt[j].lstrip().startswith('Performance Standards') and not banner.search(txt[j]):
            line = txt[j]
            left = line[:18].strip()
            if left.startswith('Measurement'): dom = 'MG'
            elif left.startswith('Number'): dom = 'NA'
            elif left.startswith('Data'): dom = 'DP'
            # A number can sit a few columns left of the header ("1." at 56 under "The learners" at 59).
            nm = re.search(r'(?<![\w.])(\d{1,2})\.\s', line[max(0, col - 6):col + 3])
            start = max(0, col - 6) + nm.start(1) if nm else col
            right = line[start:].strip() if len(line) > start else ''
            if 'Page ' in line and ' of 73' in line or 'MATATAG Curriculum' in line: j += 1; continue
            mm = re.match(r'^(\d+)\.\s+(.*)', right)
            if mm: comps.append({'n': int(mm.group(1)), 'domain': dom, 'text': mm.group(2)})
            elif right and comps: comps[-1]['text'] += ' ' + right
            j += 1
        for c in comps:
            t = unicodedata.normalize('NFKC', c['text'])  # 𝑦 = 𝑎𝑥 → y = ax
            t = re.sub(r'\s+', ' ', t).strip()
            t = re.sub(r'\s?"', '^2', t)  # superscript 2 comes out as "
            t = re.sub(r'(?<=x)\s?#', '^4', t)
            t = t.replace('2$', '2^3')  # superscript 3 (Grade 6 Q2, exponents)
            c['text'] = re.sub(r'\s+([,.;)])', r'\1', t.replace('−', '-'))
        out.setdefault(g, {})[q] = comps
        i = j
    # Fractions drawn as glyphs the text layer can't read (Grade 1 Q4 ½ and ¼, from the quarter's performance standard; Grade 6 Q1 1/3).
    fix = {(6, 1, 8): 'divide: a. 1- to 2-digit whole numbers resulting in a repeating (non-terminating) decimal quotient (e.g., 1/3 = 0.3333…), and b. a whole number by a decimal of 1 decimal place.', (1, 4, 1): 'illustrate 1/2 and 1/4 as parts of a whole.', (1, 4, 2): 'compare 1/2 and 1/4 using models.'}
    for (g, q, n), t in fix.items(): out[g][q][n - 1]['text'] = t
    return out


def science_competencies(txt):
    out = {}
    banner = re.compile(r'GRADE (\d+) [–-] QUARTER (\d)')
    footer = re.compile(r'Page \d+ of 72|MATATAG Curriculum: Science')
    i = 0
    while i < len(txt):
        m = banner.search(txt[i])
        if not m: i += 1; continue
        g, q = int(m.group(1)), int(m.group(2))
        j, col = i + 1, None
        while j < i + 8:
            idx = [k.start() for k in re.finditer(r'[Tt]he learners|Learners learn', txt[j]) if k.start() > 40]
            if idx: col = idx[-1] - 2; break
            j += 1
        if col is None: print('no header', g, q, txt[i].strip(), file=sys.stderr); i += 1; continue
        comps = []
        j += 1
        while j < len(txt) and not re.match(r'\s*Performance Standard', txt[j]) and not banner.search(txt[j]):
            line = txt[j]
            if footer.search(line): j += 1; continue
            nm = re.search(r'(?<![\w.])(\d{1,2})\.\s', line[max(0, col - 8):col + 7])
            start = max(0, col - 8) + nm.start(1) if nm else col
            right = line[start:].strip() if len(line) > start else ''
            mm = re.match(r'^(\d+)\.\s+(.*)', right)
            if mm and int(mm.group(1)) == (comps[-1]['n'] + 1 if comps else 1): comps.append({'n': int(mm.group(1)), 'text': mm.group(2)})
            elif right and comps: comps[-1]['text'] += ' ' + right
            j += 1
        for c in comps:
            t = unicodedata.normalize('NFKC', c['text'])
            t = re.sub(r'\s+', ' ', t).strip()
            c['text'] = re.sub(r'\s+([,.;)])', r'\1', t).rstrip(';').removesuffix(' and').rstrip(';,').strip()
        if comps: out.setdefault(g, {})[q] = comps
        i = j
    return out


if __name__ == "__main__":
    math = math_competencies(open(sys.argv[1]).read().split("\n"))
    sci = science_competencies(open(sys.argv[2]).read().split("\n"))
    for name, d in (("math", math), ("science", sci)):
        for g in d:
            for q, comps in d[g].items():
                ns = [c["n"] for c in comps]
                assert ns == list(range(1, len(ns) + 1)), f"{name} G{g} Q{q}: numbering {ns}"
                for c in comps:
                    c["text"] = c["text"].replace("non- ", "non-")
                    assert not re.search(r'[!"#$]', c["text"]), f"{name} G{g} Q{q} #{c['n']}: unreadable glyphs: {c['text']}"
        print(f"{name}: {sum(len(c) for v in d.values() for c in v.values())} competencies", file=sys.stderr)
    json.dump({"math": math, "science": sci}, sys.stdout, ensure_ascii=False, indent=1)
