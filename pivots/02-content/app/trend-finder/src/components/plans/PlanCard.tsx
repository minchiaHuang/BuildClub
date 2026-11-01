import { useDraggable } from "@dnd-kit/core";
import type { Format, IdeaStatus, SavedIdea, Video } from "../../types";
import { compact, plural } from "../../lib/metrics";
import { beatUsual } from "../find/words";
import { Thumb } from "../Thumb";
import {
  dueLabel,
  planName,
  shotsOf,
  type DragData,
} from "./moves";

// What a plan card shows: the video, what it copies, the due date and shots. Shared by the card and its drag copy.
export function PlanCardBody({
  idea,
  video: v,
  format: f,
}: {
  idea: SavedIdea;
  video: Video;
  format?: Format;
}) {
  const shots = shotsOf(idea, f).length;
  return (
    <>
      <Thumb video={v} />
      <div className="board-card-body">
        <strong>{planName(v, f)}</strong>
        <span className="small muted">
          Copies {v.live ? v.handle : `"${v.hook}" by ${v.handle}`} ·{" "}
          {compact(v.views)} views,{" "}
          {beatUsual(v).replace(/^\w/, (c) => c.toLowerCase())}
        </span>
        <span className="small">
          Due {dueLabel(idea.dueDate)} ·{" "}
          {shots ? (
            plural(shots, "shot")
          ) : (
            <span className="muted">No shots yet</span>
          )}
        </span>
        {idea.status === "rejected" && (
          <span className="board-reason small">
            You sent it back: {idea.rejectReason || "no reason given"}. Fix it,
            then send it again.
          </span>
        )}
      </div>
    </>
  );
}

interface Props {
  idea: SavedIdea;
  video: Video;
  format?: Format;
  // The column it shows in (a sent-back plan shows under "Still planning").
  column: IdeaStatus;
  targets: IdeaStatus[];
  onOpenPlan: () => void;
  onRemove: () => void;
}

// Clicks and taps on the card's own controls never start a drag.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const keep = { onMouseDown: stop, onTouchStart: stop, onKeyDown: stop };

export function PlanCard(p: Props) {
  const data: DragData = { status: p.idea.status, targets: p.targets };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: p.idea.id,
      data,
      disabled: p.targets.length === 0,
    });
  const name = planName(p.video, p.format);

  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    setActivatorNodeRef(el);
  };

  return (
    <div
      ref={setRef}
      data-plan={p.idea.id}
      className={`board-card plans-card${isDragging ? " is-placeholder" : ""}`}
      {...attributes}
      {...listeners}
      role="group"
      aria-roledescription="movable plan"
      aria-label={name}
    >
      <PlanCardBody idea={p.idea} video={p.video} format={p.format} />

      <div className="board-card-actions" {...keep}>
        <button className="btn btn-ghost btn-sm" onClick={p.onOpenPlan}>
          Open plan
        </button>
        <button
          className="link-btn"
          onClick={p.onRemove}
          aria-label={`Remove ${name}`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
