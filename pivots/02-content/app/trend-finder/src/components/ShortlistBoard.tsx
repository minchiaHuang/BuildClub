import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { Client, Format, IdeaStatus, SavedIdea, Video } from "../types";
import type { Decision } from "../lib/memory";
import { useApp } from "../lib/appContext";
import { PlanCard, PlanCardBody } from "./plans/PlanCard";
import { PlanColumn } from "./plans/PlanColumn";
import {
  COLUMNS,
  columnKeys,
  columnTitle,
  planName,
  shotsOf,
  targetsFrom,
} from "./plans/moves";

interface Props {
  client: Client;
  // Ideas for every client; the board shows this client's.
  ideas: SavedIdea[];
  videoById: Map<string, Video>;
  formatById: Map<string, Format>;
  onChangeIdeas: Dispatch<SetStateAction<SavedIdea[]>>;
  // The manager's decision (approve / send back), saved to client memory like Review does.
  onDecide: (ideaId: string, d: Decision) => void;
  onOpenPlan: (ideaId: string) => void;
  onFindMore: () => void;
  onReview: () => void;
  // Stage to scroll to when opened from a Home pipeline chip; cleared once done.
  focus?: IdeaStatus | null;
  onFocusDone?: () => void;
}

// Mouse and touch: the column under the pointer. Keyboard drags have no pointer, so use overlap instead.
const collision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const instructions =
  "To move a plan, press space or enter. Use the left and right arrow keys to choose a column, " +
  "then press space or enter to drop it there, or escape to cancel.";

// One client's plans as a Kanban board (the Plans tab): Still planning → Waiting for approval →
// Approved, ready to film. Drag a plan to send, approve or take it back. Plans sent back (from Review or the plan page)
// return to Still planning with your reason, ready to fix and send again. Any card can move to any column, both ways.
export function ShortlistBoard(p: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  // A plan dropped on Waiting without shots: it stays put and says why.
  // What the last move did, for screen readers.
  const [said, setSaid] = useState("");
  const focusAfter = useRef<string | null>(null);
  const canDecide = useApp().role === "manager";

  const mine = p.ideas.filter((i) => i.clientId === p.client.id);
  // Sent-back plans sit in Still planning, showing your reason, until they're fixed and sent again.
  const shownIn = (i: SavedIdea): IdeaStatus =>
    i.status === "rejected" ? "saved" : i.status;
  const by = (s: IdeaStatus) => mine.filter((i) => shownIn(i) === s);
  const formatOf = (i: SavedIdea) =>
    p.formatById.get(p.videoById.get(i.videoId)?.formatId ?? "");
  const nameOf = (i?: SavedIdea) => {
    const v = i && p.videoById.get(i.videoId);
    return v ? planName(v, formatOf(i)) : "The plan";
  };
  const lists: Record<IdeaStatus, SavedIdea[]> = {
    saved: by("saved"),
    waiting: by("waiting").sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0)),
    approved: by("approved").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    rejected: by("rejected"),
  };
  const dragging = mine.find((i) => i.id === dragId);
  const dragTargets = dragging ? targetsFrom(dragging.status, canDecide) : null;

  // Opened from a pipeline chip: bring that stage into view (after App's scroll-to-top on screen change).
  const { focus, onFocusDone } = p;
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`board-${focus}`)
        ?.scrollIntoView({ block: "start", inline: "start" });
      onFocusDone?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, onFocusDone]);

  // After a move the card re-renders in its new column: keep keyboard focus on it.
  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-plan="${id}"]`)?.focus(),
    );
  });

  const sensors = useSensors(
    // A small distance (mouse) or a short hold (touch) so clicks on "Open plan" and scrolling still work.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeys }),
  );

  const update = (
    ids: Set<string>,
    patch: (i: SavedIdea) => Partial<SavedIdea>,
  ) =>
    p.onChangeIdeas((prev) =>
      prev.map((i) => (ids.has(i.id) ? { ...i, ...patch(i) } : i)),
    );

  // Send for approval (dragging a card into Waiting for approval).
  const send = (ids: Set<string>) => {
    const sentAt = Date.now();
    update(ids, () => ({
      status: "waiting",
      sentAt,
      rejectReason: undefined,
    }));
  };

  const remove = (id: string) =>
    p.onChangeIdeas((prev) => prev.filter((i) => i.id !== id));

  // Every move (mouse, touch or keyboard drag) comes through here.
  const move = (idea: SavedIdea, to: IdeaStatus) => {
    if (!targetsFrom(idea.status, canDecide).includes(to)) return;
    const name = nameOf(idea);
    // Cards move freely, with or without shots. A card leaving Still planning with no shots keeps an
    // empty list, so it still reads "No shots yet" instead of borrowing the original video's shots.
    const shots = shotsOf(idea, formatOf(idea));
    if (idea.status === "saved" && !idea.shots)
      update(new Set([idea.id]), () => ({ shots: [] }));
    // Moving back out of Approved undoes the approval.
    const unapprove = { approvedAt: undefined, managerNote: undefined, shotComments: undefined };
    if (to === "waiting" && idea.status === "saved") send(new Set([idea.id]));
    else if (to === "waiting")
      update(new Set([idea.id]), () => ({
        status: "waiting",
        sentAt: Date.now(),
        rejectReason: undefined,
        ...unapprove,
      }));
    else if (to === "approved") p.onDecide(idea.id, { kind: "approved" });
    else
      // Back to Still planning keeps the shots written so far, so it can be sent again.
      update(new Set([idea.id]), () => ({
        status: "saved",
        sentAt: undefined,
        rejectReason: undefined,
        shots,
        ...unapprove,
      }));
    focusAfter.current = idea.id;
    setSaid(`Moved ${name} to ${columnTitle[to]}.`);
  };

  const ideaOf = (id: string | number) => mine.find((i) => i.id === id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(ideaOf(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(ideaOf(active.id))} is over ${columnTitle[over.id as IdeaStatus]}.`
        : `${nameOf(ideaOf(active.id))} is not over a column it can move to.`,
    // The board's own status line says what the drop did.
    onDragEnd: () => undefined,
    onDragCancel: ({ active }) =>
      `Cancelled. ${nameOf(ideaOf(active.id))} stayed where it was.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragId(String(active.id));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null);
    const idea = ideaOf(active.id);
    if (!idea) return;
    if (over && over.id !== idea.status) move(idea, over.id as IdeaStatus);
    else setSaid(`${nameOf(idea)} stayed in ${columnTitle[idea.status]}.`);
  };

  const card = (idea: SavedIdea, column: IdeaStatus) => {
    const v = p.videoById.get(idea.videoId);
    if (!v) return null;
    return (
      <li key={idea.id}>
        <PlanCard
          idea={idea}
          video={v}
          format={p.formatById.get(v.formatId)}
          column={column}
          targets={targetsFrom(idea.status, canDecide)}
          onOpenPlan={() => p.onOpenPlan(idea.id)}
          onRemove={() => remove(idea.id)}
        />
      </li>
    );
  };

  const empty: Record<IdeaStatus, string> = {
    saved:
      "Save videos from Find ideas. They show up here so you can plan the shots.",
    waiting: "Nothing waiting for you to approve.",
    approved: "Plans you approve show up here.",
    rejected: "",
  };

  const extra: Partial<Record<IdeaStatus, React.ReactNode>> = {
    waiting: lists.waiting.length > 0 && (
      <button
        className="btn btn-primary btn-sm board-review"
        onClick={p.onReview}
      >
        Review {lists.waiting.length}
      </button>
    ),
  };

  const dragVideo = dragging && p.videoById.get(dragging.videoId);
  const motion = !reducedMotion();

  return (
    <section className="client board">
      <header className="client-head">
        <div>
          <span className="eyebrow">{p.client.name} · Plans</span>
          <h1>Plans</h1>
          <p className="muted">
            Pick videos, write the shot lists, then send them for approval. Drag
            a plan to move it.
          </p>
        </div>
      </header>

      {mine.length === 0 ? (
        <div className="empty">
          <h2>No saved ideas yet</h2>
          <p>
            Save videos from Find ideas. They show up here so you can plan the
            shots.
          </p>
          <button className="btn btn-primary" onClick={p.onFindMore}>
            Find ideas for {p.client.name}
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: instructions },
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <div className={`plans-board${dragging ? " is-dragging" : ""}`}>
            {COLUMNS.map((s) => (
              <PlanColumn
                key={s}
                status={s}
                count={lists[s].length}
                canDrop={dragTargets ? dragTargets.includes(s) : null}
                empty={empty[s]}
                extra={extra[s]}
              >
                {lists[s].length ? (
                  <ul className="board-list">
                    {lists[s].map((i) => card(i, s))}
                  </ul>
                ) : undefined}
              </PlanColumn>
            ))}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {said}
          </p>
          {createPortal(
            <DragOverlay
              dropAnimation={
                motion
                  ? { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
                  : null
              }
            >
              {dragging && dragVideo ? (
                <div className="board-card plans-card plans-card-lifted">
                  <PlanCardBody
                    idea={dragging}
                    video={dragVideo}
                    format={formatOf(dragging)}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}
    </section>
  );
}
