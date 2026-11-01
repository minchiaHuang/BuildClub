import type { ReactNode } from "react";
import type { Client, IdeaStatus, SavedIdea, Video } from "../../types";
import type {
  DecisionStats,
  FilmPick,
  KindRow,
  PlanName,
  StepRow,
} from "../../lib/clientHome";
import { dueText, duration, monthLeft } from "../../lib/clientHome";
import { plural } from "../../lib/metrics";
import { Thumb } from "../Thumb";

// Cards for both Homes (one client and All clients). Each card: a small mono label, a serif heading, plain
// sentences and numbers with labels in the body, at most one action in the footer. No status pills or tags.
// An empty card says why it's empty. Cards that need data we don't have are placeholders (LaterCard).

export function Card(p: {
  id: string;
  className: string;
  label: string;
  title: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`ch-card ${p.className}`}
      aria-labelledby={`${p.id}-title`}
    >
      <h2 id={`${p.id}-title`}>{p.title}</h2>
      <div className="ch-card-body">{p.children}</div>
      {p.foot && <footer className="ch-card-foot">{p.foot}</footer>}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="ch-empty small muted">{children}</p>;
}

// A plain horizontal bar. The number it shows is always written next to it, so it's decoration only.
export function Bar({ value, of }: { value: number; of: number }) {
  const pct = of > 0 ? Math.min(value / of, 1) * 100 : 0;
  return (
    <span className="ch-bar" aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

// A plan in a list: what it is, which TikTok video it copies.
export interface Named extends PlanName {
  idea: SavedIdea;
  video?: Video;
}

// ① What should <client> film next?
export function FilmNextCard(p: {
  client: Client;
  picks: FilmPick[];
  // How many kinds of video were left out because they already have a plan.
  plannedKinds: number;
  onShortlist: (videoId: string) => void;
  onOpenPlans: () => void;
  empty: { text: string; fix: string; onFix: () => void; busy?: boolean };
}) {
  const [top, ...rest] = p.picks;
  const skipped =
    p.plannedKinds > 0 ? (
      <p className="small muted ch-note">
        Not suggested here: {plural(p.plannedKinds, "kind")} of video that
        already {p.plannedKinds === 1 ? "has" : "have"} a plan for{" "}
        {p.client.name}.{" "}
        <button className="link-btn" onClick={p.onOpenPlans}>
          See them in Plans
        </button>
      </p>
    ) : null;
  return (
    <Card
      id="ch-hero"
      className="ch-hero"
      label="Film next"
      title={
        <>
          What should <em>{p.client.name}</em> film next?
        </>
      }
    >
      {!top ? (
        <div className="ch-hero-empty">
          <Empty>{p.empty.text}</Empty>
          <button
            className="btn btn-primary"
            onClick={p.empty.onFix}
            disabled={p.empty.busy}
          >
            {p.empty.fix}
          </button>
        </div>
      ) : (
        <>
          <div className="ch-pick">
            <div className="ch-pick-thumb">
              <Thumb video={top.video} />
            </div>
            <div className="ch-pick-body">
              <h3>{top.name}</h3>
              <p className="ch-proof">{top.proof}</p>
              <p className="small muted ch-ref">{top.video.handle}</p>
              <div className="ch-pick-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => p.onShortlist(top.video.id)}
                >
                  Save this idea
                </button>
              </div>
            </div>
          </div>
          {rest.length > 0 && (
            <div className="ch-sub">
              <span className="field-label">Also worth filming</span>
              <ul className="ch-alts">
                {rest.map((pick) => (
                  <li key={pick.key}>
                    <span className="ch-alt-text">
                      <strong>{pick.name}</strong>
                      <span className="small muted">
                        {pick.proof}. {pick.trend}
                      </span>
                    </span>
                    <button
                      className="link-btn"
                      onClick={() => p.onShortlist(pick.video.id)}
                      aria-label={`Save this idea: ${pick.name}`}
                    >
                      Save this idea
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {skipped}
    </Card>
  );
}

function PlanLine(p: {
  plan: Named;
  detail: string;
  onOpen: (ideaId: string) => void;
}) {
  return (
    <span className="ch-row-text">
      <button className="link-strong" onClick={() => p.onOpen(p.plan.idea.id)}>
        {p.plan.name}
      </button>
      {p.plan.copies && (
        <span className="small muted">Copies {p.plan.copies}</span>
      )}
      <span className="small muted">{p.detail}</span>
    </span>
  );
}

// ② Needs your approval. The signed-in user is the manager, the only approver.
export function NeedsApprovalCard(p: {
  waiting: Named[];
  sentBack: Named[];
  onApprove: (ideaId: string) => void;
  onReview: () => void;
  onOpenPlan: (ideaId: string) => void;
}) {
  const shown = p.waiting.slice(0, 3);
  const more = p.waiting.length - shown.length;
  return (
    <Card
      id="ch-needs"
      className="ch-needs"
      label="Needs your approval"
      title={
        p.waiting.length
          ? `${plural(p.waiting.length, "plan")} waiting for your approval`
          : "No plans waiting for your approval"
      }
      foot={
        p.waiting.length > 1 ? (
          <button className="btn btn-ghost btn-sm" onClick={p.onReview}>
            Go through all {p.waiting.length}
          </button>
        ) : undefined
      }
    >
      {p.waiting.length === 0 && (
        <Empty>
          When someone sends a plan for approval, it shows up here so you can
          approve it in one click.
        </Empty>
      )}
      {shown.length > 0 && (
        <ul className="ch-rows">
          {shown.map((plan) => (
            <li key={plan.idea.id} className="ch-row">
              <PlanLine
                plan={plan}
                detail={`Film ${dueText(plan.idea.dueDate)}`}
                onOpen={p.onOpenPlan}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => p.onApprove(plan.idea.id)}
                aria-label={`Approve ${plan.name}`}
              >
                Approve
              </button>
            </li>
          ))}
          {more > 0 && (
            <li className="small muted">and {more} more</li>
          )}
        </ul>
      )}
      {p.sentBack.length > 0 && (
        <div className="ch-sub ch-split">
          <span className="field-label">
            You sent back {plural(p.sentBack.length, "plan")} to fix
          </span>
          <ul className="ch-rows">
            {p.sentBack.slice(0, 2).map((plan) => (
              <li key={plan.idea.id} className="ch-row-stack">
                <PlanLine
                  plan={plan}
                  detail={`Your reason: ${plan.idea.rejectReason?.trim() || "none given"}`}
                  onOpen={p.onOpenPlan}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// This month: approved videos against the monthly target.
export function MonthCard(p: {
  approved: number;
  target: number;
  waiting: number;
  label?: string;
  // The card's heading, e.g. "Videos approved this month, all clients".
  heading?: string;
}) {
  const { days, month } = monthLeft();
  const need = Math.max(p.target - p.approved, 0);
  return (
    <Card
      id="ch-month"
      className="ch-month"
      label={p.label ?? "This month"}
      title={p.heading ?? "Videos approved this month"}
    >
      <p className="ch-month-num">
        <span className="ch-big">{p.approved}</span>{" "}
        <span className="muted">of {p.target} approved</span>
      </p>
      <Bar value={p.approved} of={p.target} />
      <p className="ch-line">
        {need
          ? `${need} more needed, ${plural(days, "day")} left in ${month}.`
          : `Target reached, with ${plural(days, "day")} left in ${month}.`}
        {p.waiting > 0 &&
          ` ${p.waiting} more ${p.waiting === 1 ? "is" : "are"} waiting for you to approve.`}
      </p>
    </Card>
  );
}

// Where the ideas are, one plain row per step. Each row opens that column in Plans.
export function StepsCard(p: {
  title: string;
  rows: StepRow[];
  onOpen?: (status: IdeaStatus) => void;
  empty: string;
}) {
  const total = p.rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card id="ch-steps" className="ch-steps" label="Ideas" title={p.title}>
      {total === 0 ? (
        <Empty>{p.empty}</Empty>
      ) : (
        <ul className="ch-steps-list">
          {p.rows.map((r) => {
            const body = (
              <>
                <span className="ch-count">{r.count}</span>
                <span className="ch-steps-text">
                  {r.text}
                  <Bar value={r.count} of={total} />
                </span>
              </>
            );
            return (
              <li key={r.key} className={r.count ? "" : "is-zero"}>
                {p.onOpen ? (
                  <button
                    className="ch-steps-row"
                    onClick={() => p.onOpen!(r.status)}
                    aria-label={`${r.count} ${r.text}. Open in Plans`}
                  >
                    {body}
                  </button>
                ) : (
                  <span className="ch-steps-row">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Next to film: approved plans only, soonest due first.
export function ReadyCard(p: {
  approved: Named[];
  onOpenPlan: (ideaId: string) => void;
  onOpenPlans: () => void;
}) {
  const shown = p.approved.slice(0, 3);
  return (
    <Card
      id="ch-ready"
      className="ch-ready"
      label="Next to film"
      title={
        p.approved.length
          ? `${plural(p.approved.length, "approved plan")}, ready to film`
          : "Nothing approved to film yet"
      }
      foot={
        p.approved.length > shown.length ? (
          <button className="btn btn-ghost btn-sm" onClick={p.onOpenPlans}>
            See all {p.approved.length} in Plans
          </button>
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <Empty>
          Once you approve a plan it shows up here, the one due soonest first.
        </Empty>
      ) : (
        <ol className="ch-rows ch-ready-list">
          {shown.map((plan) => (
            <li key={plan.idea.id} className="ch-row-stack">
              <PlanLine
                plan={plan}
                detail={`Approved, ${dueText(plan.idea.dueDate)}`}
                onOpen={p.onOpenPlan}
              />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// Approvals so far: from client memory (every decision is saved there).
export function DecisionsCard(p: {
  stats: DecisionStats;
  titleOf: (ideaId: string) => string;
  // All clients Home: who each sent-back plan was for.
  clientOf?: (ideaId: string) => string | undefined;
}) {
  const s = p.stats;
  const reasons = s.reasons.slice(0, 3);
  return (
    <Card
      id="ch-decisions"
      className="ch-decisions"
      label="Approvals so far"
      title={
        s.decided
          ? `You approved ${s.approved} of ${plural(s.decided, "plan")}`
          : "No decisions yet"
      }
    >
      {s.decided === 0 ? (
        <Empty>
          Every time you approve or send back a plan, Remake saves it. The
          numbers show up here after your first decision.
        </Empty>
      ) : (
        <>
          <Bar value={s.approved} of={s.decided} />
          <ul className="ch-facts">
            <li>
              <span className="ch-count">{s.approved}</span> approved
              {s.withChanges > 0 && ` (${s.withChanges} with changes)`}
            </li>
            <li>
              <span className="ch-count">{s.sentBack}</span> sent back to fix
            </li>
          </ul>
        </>
      )}
      <div className="ch-sub ch-split">
        <span className="field-label">Time to decide</span>
        <p className="ch-line">
          {s.avgDecideMs !== null
            ? `On average ${duration(s.avgDecideMs)} from a plan being sent to your decision (${plural(s.timed, "plan")}).`
            : "Not enough history yet. Remake times this once a plan is sent to you and you decide on it."}
        </p>
      </div>
      {s.decided > 0 && (
        <div className="ch-sub ch-split">
          <span className="field-label">Why plans were sent back</span>
          {reasons.length === 0 ? (
            <p className="ch-line muted">Nothing sent back yet.</p>
          ) : (
            <ul className="ch-rows">
              {reasons.map((r) => {
                const who = p.clientOf?.(r.ideaId);
                return (
                  <li key={r.key} className="ch-row-stack">
                    <span>"{r.reason}"</span>
                    <span className="small muted">
                      {p.titleOf(r.ideaId)}
                      {who ? `, for ${who}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

// What gets approved most, grouped by the kind of video each plan copies.
export function ApprovedMostCard(p: {
  rows: KindRow[];
  subject: string;
  showClients?: boolean;
}) {
  const rows = p.rows.slice(0, 4);
  const top = rows[0]?.count ?? 0;
  return (
    <Card
      id="ch-kinds"
      className="ch-kinds"
      label="What gets approved"
      title="Kinds of video approved most"
    >
      {rows.length === 0 ? (
        <Empty>
          Nothing approved yet for {p.subject}. Once you approve plans, this
          shows which kinds of video you say yes to most.
        </Empty>
      ) : (
        <>
          <p className="small muted ch-note">
            Each plan copies a TikTok video. This groups the approved ones for{" "}
            {p.subject} by the kind of video they copy.
          </p>
          <ul className="ch-kinds-list">
            {rows.map((r) => (
              <li key={r.key}>
                <span className="ch-kinds-text">
                  <strong>{r.name}</strong>
                  {p.showClients && r.clients.length > 0 && (
                    <span className="small muted">
                      For {r.clients.join(", ")}
                    </span>
                  )}
                  <Bar value={r.count} of={top} />
                </span>
                <span className="ch-kinds-num">
                  <span className="ch-count">{r.count}</span>
                  <span className="small muted">approved</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// Placeholder for analytics that need data we don't collect yet. Never shows a number.
export function LaterCard(p: { title: string; what: string; needs: string }) {
  return (
    <section className="ch-later" aria-label={`${p.title}: not built yet`}>
      <h3>{p.title}</h3>
      <p className="small">{p.what}</p>
      <p className="small muted">{p.needs}</p>
      <p className="small ch-later-ask">Needs a decision before we build this.</p>
    </section>
  );
}

export function LaterSection(p: {
  intro: string;
  cards: { title: string; what: string; needs: string }[];
}) {
  return (
    <section className="ch-later-wrap" aria-labelledby="ch-later-title">
      <div className="ch-later-head">
        <span className="field-label" id="ch-later-title">
          After videos are posted
        </span>
        <p className="small muted">{p.intro}</p>
      </div>
      <div className="ch-later-grid">
        {p.cards.map((c) => (
          <LaterCard key={c.title} {...c} />
        ))}
      </div>
    </section>
  );
}
