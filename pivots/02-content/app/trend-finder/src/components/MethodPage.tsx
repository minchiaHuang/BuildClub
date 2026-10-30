import { COPY, HIT_MULTIPLE, LIMITED_DAYS } from '../lib/evidence'

// Mirrors backend/server.py: VIDEOS_PER_AUTHOR, MIN_VIDEOS, MEDIAN_DAYS, AUTHORS_PER_SEARCH, CACHE_HOURS.
const VIDEOS_PER_AUTHOR = 6
const MIN_VIDEOS = 5
const MEDIAN_DAYS = 30
const AUTHORS_PER_SEARCH = 15
const CACHE_HOURS = 24

// Static note on how every multiple is worked out. No sign-in, no API calls.
export function MethodPage() {
  return (
    <main className="review-page method-page">
      <article>
        <h1>{COPY.methodTitle}</h1>
        <p className="muted">How {COPY.brand} turns a video's views into a multiple, and how much weight to give it.</p>

        <section>
          <h2>The formula</h2>
          <p>
            Multiple = the video's views ÷ the median views of the account's latest {VIDEOS_PER_AUTHOR} videos.
          </p>
          <p>
            With fewer than {MIN_VIDEOS} videos to take a median from, we use views ÷ followers instead and mark it
            "{COPY.rough}".
          </p>
        </section>

        <section>
          <h2>The baseline</h2>
          <ul>
            <li>The baseline is the account's latest {VIDEOS_PER_AUTHOR} videos.</li>
            <li>It is reused for {MEDIAN_DAYS} days before we fetch it again.</li>
            <li>At most {AUTHORS_PER_SEARCH} accounts get a fresh baseline per search.</li>
            <li>{COPY.methodSample}</li>
          </ul>
        </section>

        <section>
          <h2>Time windows</h2>
          <ul>
            <li>A search is cached for {CACHE_HOURS} hours, then fetched again.</li>
            <li>Pinned searches never expire.</li>
          </ul>
        </section>

        <section>
          <h2>Thresholds</h2>
          <ul>
            <li>A hit is a multiple of {HIT_MULTIPLE}× or more.</li>
            <li>
              Evidence: high. The baseline is the account's median, and at least 3 accounts in this search use the same
              pattern with at least 2 of them hitting {HIT_MULTIPLE}× or more.
            </li>
            <li>Evidence: medium. Everything else.</li>
            <li>
              Evidence: limited. The multiple uses followers instead of a median, there is no baseline size on record, or
              the video was posted more than {LIMITED_DAYS} days ago. An unknown posting date alone does not make it
              limited; it shows "{COPY.dateUnknown}".
            </li>
            <li>
              Each account counts once, by its newest video in the pattern. Accounts on the rough followers estimate are
              marked "{COPY.roughShort}" and left out of the hit rate. A pattern with fewer than 3 accounts shows "
              {COPY.oneOff}".
            </li>
            <li>
              Format stages for TikTok: fewer than 3 accounts is a one-off; 3 or more accounts with no new posts in 14
              days is probably too late; 3 or 4 accounts, all within the last 14 days, is just started; 5 or more
              accounts still posting is spreading.
            </li>
          </ul>
        </section>

        <section>
          <h2>Known biases</h2>
          <ul>
            <li>We can't see watch time or retention</li>
            <li>Instagram views include paid (boosted) views</li>
            <li>These numbers don't mean a copy will go viral</li>
            <li>Only accounts this search found are counted. Accounts we did not find are not in the numbers.</li>
            <li>{COPY.tiktokOnly}. Patterns seen on other platforms are not counted.</li>
            <li>
              Only {AUTHORS_PER_SEARCH} accounts per search get a baseline, so some videos stay on the rough followers
              estimate.
            </li>
          </ul>
        </section>
      </article>
    </main>
  )
}
