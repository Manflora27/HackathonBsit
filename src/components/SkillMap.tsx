import { useEffect, useMemo, useState } from "react";
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { skills, skillTitle } from "../data";
import { useStore } from "../store";
import type { Lang, SkillStatus } from "../types";

type SkillNodeData = {
  title: string;
  grade: number;
  status: SkillStatus;
  onPath: boolean;
  isRoot: boolean;
  lit: boolean;
};

const ICON: Record<SkillStatus, string> = { mastered: "✓", gap: "!", unknown: "" };

function SkillNode({ data }: NodeProps<Node<SkillNodeData>>) {
  const { title, grade, status, onPath, isRoot, lit } = data;
  const tone =
    isRoot && lit
      ? "border-gap bg-gap-soft ring-4 ring-gap/25 animate-pulse"
      : status === "gap"
        ? "border-gap bg-gap-soft"
        : status === "mastered"
          ? "border-ok bg-ok-soft"
          : "border-line bg-card";
  const pathTone = onPath && lit && !isRoot ? "ring-2 ring-gap" : "";
  return (
    <div className={`w-[190px] rounded-2xl border-2 px-3 py-2 shadow-sm transition-colors duration-500 ${tone} ${pathTone}`}>
      <Handle type="target" position={Position.Bottom} className="!opacity-0" />
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>Grade {grade}</span>
        {ICON[status] && (
          <span
            aria-label={status}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${status === "gap" ? "bg-gap" : "bg-ok"}`}
          >
            {ICON[status]}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[13px] font-medium leading-snug">{title}</div>
      <Handle type="source" position={Position.Top} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { skill: SkillNode };

export function SkillMap({
  statuses,
  path = [],
  root = null,
  animate = false,
  height = 520,
  onSelect,
}: {
  statuses: Record<string, SkillStatus>;
  path?: string[];
  root?: string | null;
  animate?: boolean;
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const lang = useStore((s) => s.lang) as Lang;
  const reduceMotion = useStore((s) => s.reduceMotion);
  const instant = !animate || reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [lit, setLit] = useState(instant ? path.length : 0);

  useEffect(() => {
    if (instant) {
      setLit(path.length);
      return;
    }
    setLit(0);
    const timers = path.map((_, i) => setTimeout(() => setLit(i + 1), 450 + i * 800));
    return () => timers.forEach(clearTimeout);
  }, [path.join(","), instant]); // eslint-disable-line react-hooks/exhaustive-deps

  const litSet = new Set(path.slice(0, lit));
  const nodes: Node<SkillNodeData>[] = useMemo(
    () =>
      skills.map((s) => ({
        id: s.id,
        type: "skill",
        position: { x: s.x * 230, y: s.y * 125 },
        data: {
          title: skillTitle(s.id, lang),
          grade: s.grade,
          status: statuses[s.id] ?? "unknown",
          onPath: path.includes(s.id),
          isRoot: s.id === root && lit >= path.length,
          lit: litSet.has(s.id),
        },
        draggable: false,
      })),
    [statuses, path, root, lit, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const s of skills) {
      for (const p of s.prereqs) {
        const i = path.indexOf(s.id);
        const onPath = i >= 0 && path[i + 1] === p;
        const isLit = onPath && lit > i + 1;
        out.push({
          id: `${p}-${s.id}`,
          source: p,
          target: s.id,
          animated: isLit,
          style: {
            stroke: isLit ? "var(--color-gap)" : "#d6d3e6",
            strokeWidth: isLit ? 3.5 : 1.5,
            transition: "stroke 0.4s, stroke-width 0.4s",
          },
        });
      }
    }
    return out;
  }, [path, lit]);

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-card border border-line bg-[#fbfaff] shadow-[var(--shadow-soft)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.2}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={!!onSelect}
        onNodeClick={(_, n) => onSelect?.(n.id)}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      />
      <ul className="sr-only">
        {skills.map((s) => (
          <li key={s.id}>
            {skillTitle(s.id, lang)}, grade {s.grade}: {statuses[s.id] ?? "not yet checked"}
            {s.id === root ? " (root gap)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
