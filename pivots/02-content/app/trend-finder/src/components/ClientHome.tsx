import type { ReactNode } from "react";
import type { Client, Format, IdeaStatus, SavedIdea, Video } from "../types";
import type { Pulse } from "../lib/clientChips";
import { clientTopic } from "../lib/clientChips";
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
  // Adds the video to the shortlist, or opens its plan when it's already there.
  onShortlist: (videoId: string) => void;
  onOpenPlan: (ideaId: string) => void;
  onOpenPlans: (stage?: IdeaStatus) => void;
  onApprove: (ideaId: string) => void;
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
            ? `Checking TikTok for "${topic}"…`
            : `Remake hasn't checked TikTok for ${client.name} today. It looks up "${topic}" once a day.`,
          fix: "Check TikTok now",
          onFix: p.onRefreshPulse,
          busy: p.pulseLoading,
        }
      : p.live
        ? {
            text: `Everything from today's TikTok check of "${topic}" already has a plan.`,
            fix: `Find ideas for ${client.name}`,
            onFix: p.onFindIdeas,
          }
        : picks.length === 0 && plannedKinds === 0
          ? {
              text: `The sample data only covers tofu, so there's nothing to suggest for ${client.name} yet.`,
              fix: `Find ideas for ${client.name}`,
              onFix: p.onFindIdeas,
            }
          : {
              text: `Every sample video that fits ${client.name} already has a plan.`,
              fix: `Find ideas for ${client.name}`,
              onFix: p.onFindIdeas,
            };

  return (
    <section className="ch ch-wide">
      <header className="ch-head">
        <div className="ch-id">
          <h1>Dashboard</h1>
          <p className="muted">
            How {client.name} is tracking this month, and what needs you.
          </p>
        </div>
        <button className="btn btn-primary" onClick={p.onFindIdeas}>
          Find ideas for {client.name}
        </button>
      </header>

      <div className="ch-grid">
        <FilmNextCard
          client={client}
          picks={picks}
          plannedKinds={picks.length ? plannedKinds : 0}
          onShortlist={p.onShortlist}
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
        intro={`These need numbers from ${possessive(client.name)} TikTok account after videos go live. Remake doesn't collect them yet, so nothing here is real data.`}
        cards={[
          {
            title: "How posted videos did",
            what: `Views on each video ${client.name} posted, next to their usual views.`,
            needs: `Would need: access to ${possessive(client.name)} TikTok stats.`,
          },
          {
            title: "Which copied videos worked",
            what: `Which of the TikTok videos we copied led to ${possessive(client.name)} best results.`,
            needs:
              "Would need: TikTok stats, plus a link from each posted video back to its plan.",
          },
          {
            title: "Follower growth",
            what: `How ${possessive(client.name)} followers changed month by month.`,
            needs: `Would need: access to ${possessive(client.name)} TikTok stats.`,
          },
        ]}
      />
    </section>
  );
}
