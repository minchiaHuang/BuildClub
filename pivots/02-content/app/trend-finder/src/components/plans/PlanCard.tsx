import { useDraggable } from "@dnd-kit/core";
import type { Format, SavedIdea, Video } from "../../types";
import type { Flags, Step } from "../../lib/steps.ts";
import { FlagBadge } from "../FlagBadge";
import { StepProgress } from "../StepProgress";
import { PostedResult } from "../publish/PostedResult";
import { compact } from "../../lib/metrics";
import { beatUsual } from "../find/words";
import { Thumb } from "../Thumb";
import { useManagerName } from "../../lib/appContext";
import { lastSentBack } from "../../lib/memory";
import { t, tp } from "../../lib/i18n";
import {
  columnTitle,
  dueLabel,
  planName,
  shotsOf,
  type DragData,
} from "./moves";

// What a plan card shows: the video, its client and due date, where it is in the six steps, any flags, and
// what to do next. Shared by the card and its drag copy.
export function PlanCardBody({
  idea,
  video: v,
  format: f,
  clientName,
  step,
  flags,
  next,
}: {
  idea: SavedIdea;
  video: Video;
  format?: Format;
  clientName: string;
  step: Step;
  flags: Flags;
  next: string;
}) {
  const shots = shotsOf(idea, f).length;
  const manager = useManagerName();
  const last = idea.status !== "rejected" ? lastSentBack(idea) : undefined;
  return (
    <>
      <Thumb video={v} />
      <div className="board-card-body">
        <strong>{planName(v, f)}</strong>
        <span className="small pb-client">{clientName}</span>
        <span className="small muted">
          {t("plan.card.copiesLine", {
            what: v.live
              ? t("plan.card.copiesLive", { handle: v.handle })
              : t("plan.card.copiesVideo", { hook: v.hook, handle: v.handle }),
            views: compact(v.views),
            beat: beatUsual(v).replace(/^\w/, (c) => c.toLowerCase()),
          })}
        </span>
        <span className="small">
          {t("plan.card.due", { date: dueLabel(idea.dueDate) })} ·{" "}
          {shots ? (
            tp("plan.card.shots", shots)
          ) : (
            <span className="muted">{t("plan.card.noShots")}</span>
          )}
        </span>
      </div>
      <div className="pb-foot">
        <StepProgress step={step} />
        {(flags.stuckDays !== undefined || flags.overdueDays !== undefined) && (
          <div className="pb-flags">
            {flags.overdueDays !== undefined && <FlagBadge kind="overdue" days={flags.overdueDays} />}
            {flags.stuckDays !== undefined && <FlagBadge kind="stuck" days={flags.stuckDays} />}
          </div>
        )}
        {step === "posted" && <PostedResult ideaId={idea.id} />}
        <p className="pb-next small">
          <span className="pb-next-label">{t("plan.card.next")}</span> {next}
        </p>
        {idea.status === "rejected" && (
          <span className="board-reason small">
            {t("plan.card.sentBack", { manager })}{" "}
            {idea.rejectTags?.length ? `${idea.rejectTags.join(" · ")}. ` : ""}
            {idea.rejectReason || (idea.rejectTags?.length ? "" : t("plan.card.noReason"))}
          </span>
        )}
        {last && (
          <span className="board-reason small">
            {t("plan.card.lastSentBack", { manager })}{" "}
            {last.tags?.length ? `${last.tags.join(" · ")}. ` : ""}
            {last.reason ?? ""}
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
  clientName: string;
  step: Step;
  flags: Flags;
  next: string;
  // The steps it can be dropped on (empty: it cannot be dragged).
  targets: Step[];
  onMove: (to: Step) => void;
  onOpenPlan: () => void;
  onRemove: () => void;
  onDueChange: (iso: string) => void;
  // Extra controls on the card, e.g. taking a waiting plan back.
  actions?: React.ReactNode;
}

// Clicks and taps on the card's own controls never start a drag.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const keep = { onMouseDown: stop, onTouchStart: stop, onKeyDown: stop };

export function PlanCard(p: Props) {
  const data: DragData = { step: p.step, targets: p.targets };
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
      data-step={p.step}
      className={`board-card plans-card pb-card${isDragging ? " is-placeholder" : ""}${p.targets.length === 0 ? " is-locked" : ""}`}
      {...attributes}
      {...listeners}
      role="group"
      aria-roledescription={t("plan.card.roleDescription")}
      aria-label={name}
    >
      <PlanCardBody
        idea={p.idea}
        video={p.video}
        format={p.format}
        clientName={p.clientName}
        step={p.step}
        flags={p.flags}
        next={p.next}
      />

      <div className="board-card-actions" {...keep}>
        <button className="btn btn-ghost btn-sm" onClick={p.onOpenPlan}>
          {t("plan.card.openPlan")}
        </button>
        {p.targets.length > 0 && (
          <select
            className="stage-select pb-move"
            aria-label={t("plan.card.moveTo", { name })}
            value=""
            onChange={(e) => e.target.value && p.onMove(e.target.value as Step)}
          >
            <option value="">{t("plan.card.moveToOption")}</option>
            {p.targets.map((to) => (
              <option key={to} value={to}>
                {columnTitle(to)}
              </option>
            ))}
          </select>
        )}
        {p.actions}
        <label className="pb-due">
          <span className="sr-only">{t("plan.card.dueFor", { name })}</span>
          <input
            type="date"
            value={p.idea.dueDate}
            onChange={(e) => e.target.value && p.onDueChange(e.target.value)}
          />
        </label>
        <button
          className="link-btn"
          onClick={p.onRemove}
          aria-label={t("plan.card.removeAria", { name })}
        >
          {t("plan.card.remove")}
        </button>
      </div>
    </div>
  );
}
