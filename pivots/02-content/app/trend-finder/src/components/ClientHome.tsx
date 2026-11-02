import type { ReactNode } from "react";
import type { Client, Format, IdeaStatus, SavedIdea, Video } from "../types";
import type { Pulse } from "../lib/clientChips";
import { clientTopic } from "../lib/clientChips";
import { t } from "../lib/i18n";
import {
  filmNext,
  planName,
  plannedFormatIds,
  possessive,
} from "../lib/clientHome";
import {
  FilmNextCard,
  LaterSection,
  MonthCard,
  NeedsApprovalCard,
  ReadyCard,
} from "./home/HomeCards";
import type { Named } from "./home/HomeCards";

interface Props {
  client: Client;
  // Ideas shown in this mode (sample or live); allIdeas names plans in client memory.
  ideas: SavedIdea[];
  allIdeas: SavedIdea[];
  videoById: Map<string, Video>;
  formatById: Map<string, Format>;
  live: boolean;
  pulse: Pulse | undefined;
  pulseLoading: boolean;
  pulseError?: string | null;
  onRefreshPulse: () => void;
  // Not shown any more: Home has no search bar (searching lives in Find ideas). Kept optional so App
  // still compiles; App can stop passing search and onSearch.
  search?: ReactNode;
  onSearch?: (text: string) => void;
  onFindIdeas: () => void;
  // Film next: save a video to Plans, undo that, or open its plan to write the shots.
  onSave: (videoId: string) => void;
  onUndoSave: (videoId: string) => void;
  onPlanShots: (videoId: string) => void;
  onOpenPlan: (ideaId: string) => void;
  onOpenPlans: (stage?: IdeaStatus) => void;
  onApprove?: (ideaId: string) => void;
  onReview: () => void;
  onEditBrief?: () => void;
}

// One client's Home: how this client is doing before anything is posted (approved vs target, where the ideas
// are, what's waiting for the manager, how decisions go), plus a short "film next" suggestion. Every number
// comes from existing app data. Post-performance analytics are marked placeholders (LaterSection).
export function ClientHome(p: Props) {
  const { client } = p;
  const topic = clientTopic(client);
  const mine = p.ideas.filter((i) => i.clientId === client.id);
  const named = (idea: SavedIdea): Named => ({
    idea,
    video: p.videoById.get(idea.videoId),
    ...planName(idea, p.videoById, p.formatById),
  });
  const by = (s: IdeaStatus) => mine.filter((i) => i.status === s);
  const waiting = by("waiting")
    .sort(
      (a, b) =>
        (a.sentAt ?? 0) - (b.sentAt ?? 0) || a.dueDate.localeCompare(b.dueDate),
    )
    .map(named);
  const approved = by("approved")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(named);
  const sentBack = by("rejected").map(named);

  const picks = filmNext({
    client,
    live: p.live,
    pulse: p.pulse,
    ideas: p.ideas,
    videoById: p.videoById,
  });
  const plannedKinds = p.live
    ? 0
    : plannedFormatIds(p.ideas, client.id, p.videoById).size;

  // Why "film next" might be empty, and the one thing that fixes it.
  const empty =
    p.live && !p.pulse
      ? {
          text: p.pulseLoading
            ? t("home.client.checking", { topic })
            : t("home.client.notChecked", { name: client.name, topic }),
          fix: t("home.client.checkNow"),
          onFix: p.onRefreshPulse,
          busy: p.pulseLoading,
        }
      : p.live
        ? {
            text: t("home.client.allPlannedLive", { topic }),
            fix: t("home.client.findIdeas", { name: client.name }),
            onFix: p.onFindIdeas,
          }
        : picks.length === 0 && plannedKinds === 0
          ? {
              text: t("home.client.sampleOnlyTofu", { name: client.name }),
              fix: t("home.client.findIdeas", { name: client.name }),
              onFix: p.onFindIdeas,
            }
          : {
              text: t("home.client.allPlannedSample", { name: client.name }),
              fix: t("home.client.findIdeas", { name: client.name }),
              onFix: p.onFindIdeas,
            };

  return (
    <section className="ch ch-wide">
      <header className="ch-head">
        <div className="ch-id">
          <h1>{t("home.client.title")}</h1>
          <p className="muted">{t("home.client.sub", { name: client.name })}</p>
        </div>
        <button className="btn btn-primary" onClick={p.onFindIdeas}>
          {t("home.client.findIdeas", { name: client.name })}
        </button>
      </header>

      <div className="ch-grid">
        <FilmNextCard
          client={client}
          picks={picks}
          plannedKinds={picks.length ? plannedKinds : 0}
          onSave={p.onSave}
          onUndo={p.onUndoSave}
          onPlanShots={p.onPlanShots}
          onOpenPlans={() => p.onOpenPlans()}
          empty={empty}
        />
        <NeedsApprovalCard
          waiting={waiting}
          sentBack={sentBack}
          onApprove={p.onApprove}
          onReview={p.onReview}
          onOpenPlan={p.onOpenPlan}
        />

        <MonthCard
          approved={approved.length}
          target={client.monthlyTarget}
          waiting={waiting.length}
        />
        <ReadyCard
          approved={approved}
          onOpenPlan={p.onOpenPlan}
          onOpenPlans={() => p.onOpenPlans("approved")}
        />
      </div>

      <LaterSection
        intro={t("home.client.laterIntro", { owner: possessive(client.name) })}
        cards={[
          {
            title: t("home.client.later1Title"),
            what: t("home.client.later1What", { name: client.name }),
            needs: t("home.client.laterNeedsStats", { owner: possessive(client.name) }),
          },
          {
            title: t("home.client.later2Title"),
            what: t("home.client.later2What", { owner: possessive(client.name) }),
            needs: t("home.client.later2Needs"),
          },
          {
            title: t("home.client.later3Title"),
            what: t("home.client.later3What", { owner: possessive(client.name) }),
            needs: t("home.client.laterNeedsStats", { owner: possessive(client.name) }),
          },
        ]}
      />
    </section>
  );
}
