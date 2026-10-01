// A Braun-style calculator keypad (after Dieter Rams' ET 66): matte grey body,
// round concave keys, dark digits, light-grey functions, one green key, one orange.
export type KeyAction = { insert: string } | { backspace: true } | { enter: true } | { text: true };

type Kind = "num" | "fn" | "op" | "go" | "del";
type Key = { label: string; kind: Kind; aria?: string };

const LAYOUT: Key[][] = [
  [{ label: "√", kind: "fn" }, { label: "^", kind: "fn" }, { label: "²", kind: "fn" }, { label: "(", kind: "fn" }, { label: ")", kind: "fn" }],
  [{ label: "7", kind: "num" }, { label: "8", kind: "num" }, { label: "9", kind: "num" }, { label: "±", kind: "fn" }, { label: "⌫", kind: "del", aria: "Backspace" }],
  [{ label: "4", kind: "num" }, { label: "5", kind: "num" }, { label: "6", kind: "num" }, { label: "÷", kind: "op", aria: "divide" }, { label: "x", kind: "fn" }],
  [{ label: "1", kind: "num" }, { label: "2", kind: "num" }, { label: "3", kind: "num" }, { label: "−", kind: "op", aria: "minus" }, { label: "+", kind: "op" }],
  [{ label: "0", kind: "num" }, { label: ".", kind: "num" }, { label: "=", kind: "op" }, { label: "or", kind: "fn" }, { label: "↵", kind: "go", aria: "Next line" }],
];

const INSERT: Record<string, string> = { "²": "^2", "−": "-", "÷": "/", "√": "sqrt(", or: " or " };

export function Keypad({ onKey, onTextMode, value = "", dark = true }: { onKey: (a: KeyAction) => void; onTextMode: () => void; value?: string; dark?: boolean }) {
  const press = (k: string) => {
    if (k === "⌫") return onKey({ backspace: true });
    if (k === "↵") return onKey({ enter: true });
    onKey({ insert: INSERT[k] ?? k });
  };

  return (
    <div className={`braun ${dark ? "braun-dark" : ""}`} aria-label="Math keypad">
      <div className="braun-top">
        <div className="braun-grille" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="braun-display" aria-live="polite" data-testid="braun-display">
          <span>{value || "0"}</span>
        </div>
        <button type="button" className="braun-abc" onMouseDown={(e) => e.preventDefault()} onClick={onTextMode} aria-label="Switch to text keyboard">
          ABC
        </button>
      </div>
      <div className="braun-keys">
        {LAYOUT.flat().map((k) => (
          <button
            key={k.label}
            type="button"
            className={`bk bk-${k.kind}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k.label)}
            aria-label={k.aria ?? k.label}
          >
            <span>{k.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
