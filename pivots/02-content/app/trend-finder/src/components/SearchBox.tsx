import { useId, useRef, useState } from "react";
import type { Platform } from "../types";
import type { ChipGroup } from "../lib/clientChips";
import { PlatformToggles } from "./PlatformToggles";
import { ClientChips } from "./ClientChips";
import type { PulseInfo } from "./ClientChips";
import { VoiceButton } from "./VoiceButton";
import { usePastSearches } from "../lib/usePastSearches";
import { t } from "../lib/i18n";

interface Props {
  inputId: string;
  value: string;
  onValueChange: (text: string) => void;
  onSearch: (text: string) => void;
  platforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  live: boolean;
  clientName: string;
  clientExamples: string[];
  chipGroups: ChipGroup[];
  pulse: PulseInfo;
  onRefreshPulse: () => void;
  autoFocus?: boolean;
  // Live mode: pick a screenshot to find videos like it.
  onImage?: (file: File) => void;
  // Home hides the trending chip row: its Trending card already shows the same data.
  hideChips?: boolean;
}

// The search card used on Find ideas (before and after searching) and on Home:
// platforms, the search bar (with voice), and optionally one row of search ideas for the client.
// Find ideas passes hideChips and shows its starting points below the card instead.
export function SearchBox(p: Props) {
  const [listening, setListening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const past = usePastSearches(p.value, p.live);
  const trending = p.chipGroups.find((g) => g.id === "trending");
  const oneRow = trending
    ? [trending]
    : // No trend data yet: the client's starter searches fill the row, labelled as what they are.
      [
        {
          id: "starter" as const,
          title: t('find.starter.title', { client: p.clientName }),
          chips: p.clientExamples
            .slice(0, 5)
            .map((e) => ({ label: e, value: e })),
        },
      ];

  return (
    <form
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSearch(p.value);
      }}
    >
      <div className="search-on">
        <span className="field-label">{t('find.box.searchOn')}</span>
        <PlatformToggles selected={p.platforms} onChange={p.onPlatformsChange} />
      </div>

      <label htmlFor={p.inputId} className="sr-only">
        {t('find.box.label')}
      </label>
      <div className="search-row">
        <div className="search-input">
          <input
            id={p.inputId}
            value={p.value}
            onChange={(e) => p.onValueChange(e.target.value)}
            placeholder={
              listening
                ? t('find.box.listening')
                : p.live
                  ? t('find.box.eg', { example: p.clientExamples[0] ?? "tofu recipe" })
                  : t('find.box.egDemo')
            }
            autoFocus={p.autoFocus}
            list={p.live ? listId : undefined}
            autoComplete="off"
          />
          {p.live && (
            <datalist id={listId}>
              {past.map((q) => (
                <option key={q} value={q} />
              ))}
            </datalist>
          )}
          <VoiceButton
            onText={p.onValueChange}
            onDone={(text) => {
              p.onValueChange(text);
              p.onSearch(text);
            }}
            onListeningChange={setListening}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!p.value.trim()}
          title={p.value.trim() ? undefined : t('find.box.typeFirst')}
        >
          {/https?:\/\//.test(p.value)
            ? t('find.box.findMore')
            : t('find.box.findTrending')}
        </button>
      </div>

      {p.onImage && (
        <div className="search-upload">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t('find.box.uploadAria')}
            // The visible "Upload screenshot" button opens this input, so it is not a second Tab stop.
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) p.onImage?.(file);
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
            {t('find.box.upload')}
          </button>
          <span className="small muted">{t('find.box.uploadHint')}</span>
        </div>
      )}

      {!p.hideChips && (
        <ClientChips
          clientName={p.clientName}
          groups={oneRow}
          pulse={p.pulse}
          onPick={(value) => {
            p.onValueChange(value);
            p.onSearch(value);
          }}
          onRefresh={p.onRefreshPulse}
        />
      )}
    </form>
  );
}
