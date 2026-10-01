# DepEd curriculum sources (Math G1-12, Science/Physics/Chemistry G7-12)

Researched 2026-10-01. Files were downloaded and parsed with `pdftotext -layout`; claims marked (verified) were checked against the file itself. No competency codes are invented here. Counts are approximate.

## 1. Primary sources

### A. MATATAG K-10 (2023 guides, current for G1-10)
| Doc | URL | Notes |
|---|---|---|
| MATATAG Mathematics CG Grades 1, 4, 7 (Phase 1 extract) | https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf | 36 pp, text PDF (verified) |
| MATATAG Mathematics (Grades 1-10), Aug 2023, 73 pp | "FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf" on DepEd LR Portal https://sites.google.com/deped.gov.ph/deped-lrportal/revised-k-10-lms ; mirror (verified, 73 pp): https://matatagcurriculum.com/wp-content/uploads/2024/11/MATATAG-Curriculum-Grade-1-10-Maths.pdf ; mirror https://www.academ-e.ph/wp-content/uploads/2023/09/Mathematics-CG-2023.pdf | The deped.gov.ph-hosted full file was not found directly. Use the LR Portal copy as canonical and diff against the mirror. |
| MATATAG Science CG Grades 4 and 7 (Phase 1 extract) | https://www.deped.gov.ph/wp-content/uploads/MATATAG-Science-CG-Grade-4-and-7.pdf | 38 pp (verified) |
| MATATAG Science (Grades 3-10), 2023, 72 pp | LR Portal (same page as above); mirror (verified) https://eduksama.com/wp-content/uploads/2024/10/FINAL-MATATAG-Science-CG-2023-Grades-3-10.pdf | Science starts at G3. G1-2 science is not in this guide. |
| Landing pages | https://www.deped.gov.ph/matatag-curriculum/ , https://www.deped.gov.ph/matatagcurriculumk147/ , FAQ https://www.deped.gov.ph/wp-content/uploads/FAQs-ON-THE-MATATAG-CURRICULUM.pdf | |

### B. Old K-12 (2016 edition) guides
| Doc | URL | Notes |
|---|---|---|
| K to 12 Curriculum Guide Mathematics G1-10 (Aug 2016, with tagged math equipment), 257 pp | https://depedbohol.org/v2/wp-content/uploads/2016/03/Math-CG_with-tagged-math-equipment.pdf (division-hosted copy, verified); portal entry https://lrmds.deped.gov.ph/detail/5455 (listed as 109 pp, probably an earlier edition) | I could not confirm a deped.gov.ph-hosted URL. |
| K to 12 Science CG G3-10 (Aug 2016, with tagged sci equipment), 203 pp | https://depedbohol.org/v2/wp-content/uploads/2016/03/Science-CG_with-tagged-sci-equipment.pdf (verified) | |
| Revised K-10 Budget of Work (Math 7) | https://www.deped.gov.ph/wp-content/uploads/BOW-Math-7.pdf | Quarterly BOW, not the CG. |

### C. Senior High School
**Old SHS (2016/2017), now being phased out.** These are core General Math and Physical Science, plus STEM specialized General Physics 1/2 and General Chemistry 1/2, each with codes. The official copies are on the DepEd Learning Portal (https://lrmds.deped.gov.ph/detail/14412 is the "General Physics 1 CG", Grade 12, 435 KB, "Copyright: Yes, owner Department of Education"). The older deped.gov.ph/wp-content/uploads/2019/01/SHS-Core_*.pdf URLs I guessed returned 404 (verified). Third-party copies exist on Scribd, SlideShare and Teach Pinas (https://www.teachpinas.com/k-12-curriculum-guides-cg-compilation/). Treat those as unofficial.

**Strengthened SHS (current).** Landing page https://www.deped.gov.ph/strengthened-shs-program/ (pilot G11 in SY2025-26 per DM 48 s.2025; full G11 rollout SY2026-27; G12 pilot for the pilot cohort). Core subjects are cut to five: Effective Communication, Life Skills, General Mathematics, General Science, and Pag-aaral ng Kasaysayan at Lipunang Pilipino. The core subjects are taken in G11 only. All files are under https://www.deped.gov.ph/wp-content/uploads/ and were verified as text PDFs of 5-10 pp each. Filenames are unstable and duplicated: the page lists several revisions per subject, such as "Chemistry-1.pdf" and "Chemistry-1-Updated-as-of-060526.pdf". Re-scrape the landing page for the newest "Updated as of" file.
- GENERAL-MATHEMATICS-1.pdf (CG, 8 pp), General-Mathematics-2.pdf (3-term budget of work, 10 pp), General-Mathematics_LE.pdf / _LAS.pdf (learner materials)
- GENERAL-SCIENCE-1.pdf (CG, 8 pp), General-Science-2.pdf, General-Science_LE/_LAS.pdf
- Physics-1-1.pdf, Physics-1-2.pdf, Physics-2-1/2-2, Physics-3-1/PHYSICS-3, Physics-4-1/PHYSICS-4
- Chemistry-1.pdf, Chemistry-1-Updated-as-of-060526.pdf, Chemistry-2-2.pdf, Chemistry-2-Updated-as-of-073026.pdf, Chemistry-3-1/CHEMISTRY-3, Chemistry-4-1/CHEMISTRY-4
- Conceptual-Physics-and-Chemistry-in-Daily-Life-Updated-as-of-05.29.26.pdf
- Math electives: Finite-Mathematics-1/2, Pre-Calculus.pdf, Advanced-Mathematics-Updated-as-of-05.29.26.pdf, Basic-Calculus-Updated-as-of-05.29.26.pdf
- Also Biology 1-4, Earth-and-Space-Science 1-4, and Conceptual Biology and Earth and Space Science.
- "Physics-1-1" and "Physics-1-2" were not mapped to semester or term (not verified). Open each file's header to check the course and semester.

## 2. Competency codes
- **2016 Math and Science CGs: codes ARE published.** They are in a table column named "CODE". Format examples seen in the text: `M1NS-Ia-...`, `M7NS-Ia-1`-style (M + grade + domain + quarter roman numeral + week letter + sequence), and for science `S7LT-...`, `S8FE-...`, `S3ES-...` (prefix pattern verified: LT, FE, ES, MT). The code-pattern list was verified against the PDFs, but I did not record specific full code values from the text. Pull exact values from the parse. Observed quirks: codes wrap across lines (for example `M1NS-Ia-` then the number on the next line), the number has stray spaces (`M1NS- Id-5`), and some competencies have sub-numbers. A strict regex gives only about 0-3 matches for G1-G5 math, but a prefix-only regex finds 66-107 per grade, so normalise before extraction. The domain letters seen for math included NS, and I did not enumerate the others.
- **MATATAG (Math and Science, 2023): NO codes are published (verified).** Competencies are numbered 1..N within each Quarter table, with content domain tags (NA = Number and Algebra, MG = Measurement and Geometry, DP = Data and Probability). Rows pair a Content, a Content Standard and Learning Competencies. You must mint stable IDs yourself, for example `MAT-G7-Q1-007`, and mark them as app-defined, not DepEd codes.
- **Strengthened SHS (2025-26): NO codes in the guides checked (verified by regex across 10 files).** Competencies are numbered per quarter or term.
- **Old SHS (2016): codes published**, for example `M11GM-Ia-1` and `S11/12ES-Ie-29` (per search-result snippets of third-party copies, not fetched from DepEd). Old Physics codes were reported as `STEM_GP12...`, which is not verified.

## 3. Approximate Math competencies per grade
- **MATATAG** (heuristic parse of numbered items per quarter; undercounted for some tables): about 10-16 per quarter, so roughly 45-55 per grade for G1-6, and about 40-50 for G7-10 (my parse gave 23-52, but several quarter tables failed to parse). Treat as roughly 12 per quarter (about 48 per grade, about 480 across G1-10) and re-count after proper extraction.
- **2016 CG** (code-prefix occurrences, some duplicates): G1 about 66, G2 about 93, G3 about 80, G4 about 86, G5 about 107, G6 about 89, G7 about 65, G8 about 57, G9 about 47, G10 about 50.
- **SHS:** each strengthened course guide is only 5-10 pages with roughly 14-30 competencies per course. General Mathematics is 160 hours per year and Physics/Chemistry electives are 80 hours per semester. Old SHS General Math had roughly 80 codes (not verified).

## 4. Coverage, MATATAG vs old K-12
- MATATAG covers K-10 (Math G1-10, Science G3-10; G1-2 science is folded into other areas, so Science G7-10 is the relevant range for this app). The original rollout was Phase 1 (SY24-25) K/G1/G4/G7, Phase 2 (SY25-26) G2/G5/G8, Phase 3 (SY26-27) G3/G6/G9, and G10 in SY27-28. Secondary sources say it was accelerated, with G3 in 25-26 and G10 in 26-27. This conflict is not resolved from primary sources. Check the latest DepEd order (baseline DO 010 s.2024) before relying on it.
- As of 2026-10, G1-9 are probably MATATAG and G10 is either MATATAG or transitioning. The 2016 guides are still the reference for legacy materials and for anything with codes.
- G11-12: the Strengthened SHS curriculum (2025+) is current for G11, with G12 piloting. The 2016 SHS guides are legacy.
- Recommendation: use the MATATAG guides as the primary skeleton for G1-10 and the Strengthened SHS guides for G11-12. Use the 2016 guides only for optional cross-mapping, such as MATATAG competency to legacy code, which would need manual alignment.

## 5. License and reuse
- No explicit license (Creative Commons or similar) appeared in any downloaded PDF text (grep for creative commons, copyright and all rights: 0 hits in the three math and science PDFs checked). The DepEd Learning Portal lists the 2016 General Physics 1 CG with "Copyright: Yes, Owner: Department of Education".
- My understanding (not verified here, and not legal advice) is that under the Philippine IP Code (RA 8293, Sec. 176) works of the government have no copyright, but the agency may require prior approval and conditions for commercial exploitation. For a hackathon or non-commercial educational use, citing DepEd as source is low risk. Ask DepEd before commercial deployment.
- Prefer linking to deped.gov.ph or the LR Portal over redistributing third-party mirrors (Scribd, SlideShare, matatagcurriculum.com, eduksama and so on). Those are unofficial and may be out of date. Store only the extracted competency text and a source URL, not the PDFs.
- Be careful about redistributing the extracted data as a standalone dataset. Add an attribution line such as "Source: DepEd MATATAG Curriculum Guide, Aug 2023".

## 6. Extraction difficulty
All PDFs fetched are text-based, not scanned. `pdftotext -layout` returned usable text (math 2016: 1.59 MB text; MATATAG math: 220 KB; science 2016: 1.26 MB; SHS: 10-25 KB each). Difficulty ratings:
- **Strengthened SHS (G11-12):** easy. Short documents. Rows are Content, Standards, then numbered Competencies, with a quarter or term banner.
- **MATATAG Math/Science:** moderate. Multi-column tables with a quarter banner such as "GRADE 7 – QUARTER 1", a domain tag, wrapped competency lines and a./b. sub-items. Use pdfplumber table extraction or a layout-aware column parser that splits on the numeric prefix. The competency numbering restarts per quarter. Budget a few hours plus manual QA. The full file's top-level page count is reported as 8 by `file`, but `pdfinfo` says 73 pages, so use pdfinfo.
- **2016 Math/Science:** hard. 257/203 pages of wide tables with Content, Standards, Competency, CODE and a "Math Grade N p. xx" teacher-resource references column. Codes wrap or are split across lines, and some competencies span pages. Use pdfplumber with table settings plus code normalisation, then validate sequences against the quarter/week pattern.
- Fallback: a human or LLM-assisted pass to fix the rows that fail validation (for example, check each quarter's numbered items are consecutive).

## Open items
- Find the deped.gov.ph or LR Portal canonical URL for the full MATATAG Grades 1-10 Math and Grades 3-10 Science PDFs (the LR Portal is a Google Sites page that needs a browser to reach the file link).
- Confirm the G10 and G12 current-year status from the latest DepEd memoranda.
- Obtain the official old SHS General Math, Physical Science, General Physics and General Chemistry PDFs (LR Portal) if codes are needed for G11-12.
