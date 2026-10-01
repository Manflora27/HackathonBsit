// Calculator-style math keypad, so phones don't need the text keyboard for math.
const ROWS = [
  ["7", "8", "9", "(", ")", "⌫"],
  ["4", "5", "6", "x", "^", "²"],
  ["1", "2", "3", "+", "−", "="],
  ["0", ".", "/", "√", "±", "↵"],
];

export type KeyAction = { insert: string } | { backspace: true } | { enter: true } | { text: true };

const LABEL: Record<string, string> = { "↵": "↵", "⌫": "⌫" };

export function Keypad({ onKey, onTextMode }: { onKey: (a: KeyAction) => void; onTextMode: () => void }) {
  const press = (k: string) => {
    if (k === "⌫") return onKey({ backspace: true });
    if (k === "↵") return onKey({ enter: true });
    const ins = k === "²" ? "^2" : k === "−" ? "-" : k === "√" ? "sqrt(" : k;
    onKey({ insert: ins });
  };
  return (
    <div className="card-flat !rounded-[26px] !p-2" aria-label="Math keypad">
      <div className="grid grid-cols-6 gap-1.5">
        {ROWS.flat().map((k) => (
          <button
            key={k}
            type="button"
            className={`key ${/[0-9.]/.test(k) ? "" : k === "↵" ? "!bg-brand !text-white" : k === "⌫" ? "!bg-gap-soft" : "!bg-soft"}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
            aria-label={k === "⌫" ? "Backspace" : k === "↵" ? "Next line" : k}
          >
            {LABEL[k] ?? k}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button type="button" className="key flex-1 !text-[15px]" onMouseDown={(e) => e.preventDefault()} onClick={() => onKey({ insert: " or " })}>
          or
        </button>
        <button type="button" className="key flex-1 !text-[15px]" onMouseDown={(e) => e.preventDefault()} onClick={onTextMode}>
          ABC ⌨
        </button>
      </div>
    </div>
  );
}
