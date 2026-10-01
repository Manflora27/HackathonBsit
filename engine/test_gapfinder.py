import json
from pathlib import Path

import pytest

import gapfinder as g

GOLDEN = json.loads((Path(__file__).parent / "golden.json").read_text())


@pytest.mark.parametrize("case", GOLDEN, ids=[c["id"] for c in GOLDEN])
def test_golden(case):
    res = g.analyze(case["problem"], case["steps"], case.get("kind", "solve"))
    assert res["errorIndex"] == case["errorIndex"], res
    expected_mc = case.get("misconception")
    got_mc = res["misconception"]["id"] if res["misconception"] else None
    assert got_mc == expected_mc, res
    if "complete" in case:
        assert res["complete"] == case["complete"], res


def test_check_answer_forms():
    assert g.check_answer("(x+2)(x+5)", "x^2+7x+10", "expanded")["correct"]
    assert not g.check_answer("(x+2)(x+5)", "(x+2)(x+5)", "expanded")["correct"]
    assert g.check_answer("x=3", "x=3", "solved")["correct"]
    assert not g.check_answer("-3/4", "3/4")["correct"]


def test_unparseable_step_is_reported_not_crashed():
    res = g.analyze("2x+3=7", ["2x==4"])
    assert res["steps"][0]["status"] == "unparsed"


def test_run_roundtrip():
    out = json.loads(g.run(json.dumps({"op": "preview", "text": "x^2 + 6x + 9"})))
    assert out["ok"] and "x^{2}" in out["latex"]


def test_solve_key():
    assert g.solve_key("x^2-5x+6=0")["solutions"] == ["2", "3"]


DATA = Path(__file__).parent.parent / "src" / "data"


def _load(name):
    return json.loads((DATA / name).read_text())


def test_every_probe_key_is_verified():
    for skill in _load("skills.json")["skills"]:
        for p in skill["probes"]:
            res = g.check_answer(p["given"], p["expected"], p["form"])
            assert res["correct"], (skill["id"], p, res)


def test_every_practice_problem_has_a_sympy_key():
    lessons = _load("lessons.json")["lessons"]
    for sid, lesson in lessons.items():
        for p in lesson["practice"]:
            key = g.solve_key(p["given"])
            assert key["ok"], (sid, p)
            # the computed key must itself pass the form check it will be graded with
            answer = key["answer"]
            if p["form"] == "factored":
                from sympy import factor
                answer = str(factor(g.parse_step(p["given"]).expr))
            assert g.check_answer(p["given"], answer, p["form"])["correct"], (sid, p, answer)


def test_lessons_cover_all_skills_and_misconceptions_link_to_skills():
    skills = {s["id"] for s in _load("skills.json")["skills"]}
    assert skills == set(_load("lessons.json")["lessons"])
    for m in _load("misconceptions.json")["misconceptions"]:
        assert m["skill"] in skills, m
    for s in _load("skills.json")["skills"]:
        assert set(s["prereqs"]) <= skills, s


def test_rule_ids_have_misconception_entries():
    ids = {m["id"] for m in _load("misconceptions.json")["misconceptions"]}
    rule_ids = {name for name, _ in g.RULES} | {"missing_negative_root", "divided_by_variable", "lost_solution"}
    assert rule_ids <= ids, rule_ids - ids


def test_demo_problems_parse():
    for p in _load("problems.json")["problems"]:
        assert g.preview(p["given"])["ok"], p
