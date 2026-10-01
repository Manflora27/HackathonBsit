import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("verify_api", Path(__file__).parent.parent / "api" / "verify.py")
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


def test_verify_items_accepts_good_keys_and_rejects_bad_ones():
    items = [
        {"given": "(x+1)(x+4)", "expected": "x^2+5x+4", "form": "expanded"},
        {"given": "(x+2)(x+3)", "expected": "x^2+5x+7", "form": "expanded"},
        {"given": "100 m / 20 s", "expected": "5 m/s", "form": "units"},
        {"given": "H2 + O2 -> H2O", "expected": "2H2 + O2 -> 2H2O", "form": "chemistry"},
        {"given": "", "expected": "", "form": "any"},
        {"given": "x", "form": "any"},  # missing key: not verified, no crash
    ]
    assert verify.verify_items(items) == [True, False, True, True, False, False]
