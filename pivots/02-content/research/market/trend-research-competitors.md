# Competitor analysis: trending-video research tools

_Researched 26 Oct 2026 for a trending-video research tool for social media agencies, with Daphne at [Mercif](https://www.mercif.com/) as the first design partner (see `../interviews/2026-10-21-daphene-summary.md`). This sits outside the current career-consulting pivot in `PROJECT_CONTEXT.md` and is being explored for a hackathon. No pivot decision has been made._

_All facts come from each vendor's own website or vendor-written blog posts. None are independently reviewed. Prices change often, so check the vendor's page before quoting. All links accessed 26 Oct 2026 unless noted._

## Summary

Cross-platform search for outlier videos is already common. Several tools search by keyword across Instagram, TikTok and YouTube and rank videos against the account's usual performance. That is the price of entry, not a difference.

What no vendor site mentions: working per client for an agency, turning a video into a plan a team can film, checking whether a client can actually recreate it, trends moving between platforms, or local (Australian) trends.

## Tools

| Tool | What it does | Platforms | Keyword search? | Price (vendor site) |
| --- | --- | --- | --- | --- |
| [Cila](https://cila.app/) | Tracks accounts you add to lists and ranks their posts by outlier score. Transcripts, trending sounds, creator comparison, Excel export | Instagram, TikTok | Unclear. Built around tracked accounts | US$24/mo (50 accounts) or US$48/mo (250 accounts). First month half price, no free trial, 7-day refund |
| [Mysocial Outliers](https://mysocial.io/outliers/) | Search by topic or keyword and rank posts by multiple of the creator's median. Saved posts are transcribed. "Fit" score against your own content. MCP for Claude/ChatGPT | TikTok, Instagram, YouTube, X, Threads (LinkedIn via tracked creators) | Yes | US$49/mo (20 searches), US$149/mo, US$349/mo |
| [Virlo](https://virlo.ai/) | Short-form social listening: AI research agents for outliers and emerging creators, creator tracking with alerts, AI content studio, Meta ads analysis, MCP | TikTok, YouTube Shorts, Instagram Reels | Yes (via research agents) | US$49/mo (2,000 credits), US$199/mo, enterprise |
| [Shortimize](https://www.shortimize.com/blog/how-to-find-viral-video-patterns-in-your-niche) | Tracks accounts and sorts by viral ratio against the median | TikTok, Instagram, YouTube | Not checked | Not checked |
| [Outliers (Chrome extension)](https://chromewebstore.google.com/detail/outliers/heogkfpbeagpoodininnfhdgjmpdalgj?hl=en) | Sorts your feed by outlier metrics and exports to sheets | Instagram, TikTok, YouTube | No. Works on the feed you're viewing | Not checked |
| [Jupitrr viral video search](https://jupitrr.com/features/viral-video-search) | Search with filters for views, subscribers and outlier score | YouTube, Instagram, TikTok | Yes (per search snippet) | Not checked. Page returned 403, so this is from search results only |
| Eden | Claims outlier scoring across six platforms, per [its own blog](https://eden.so/blog/best-content-research-tools/) | X, LinkedIn, Instagram, TikTok, YouTube, Substack | Not checked | Not checked |
| 1of10, vidIQ Outliers | Outlier finders, per [AIR Media-Tech](https://air.io/en/ai-tools/top-6-viral-video-research-tools-every-creator-must-know-in-2026) (updated 30 Jan 2026) | YouTube only | Yes | 1of10 US$49–89/mo; vidIQ free to about US$19/mo |

Other sources used: [Virlo blog: best real-time trend detection tools 2026](https://virlo.ai/blog/best-real-time-trend-detection-tools-short-form-video-2026) (written by a competitor, so its ranking is biased).

## How everyone defines "trending"

Almost every tool uses an **outlier score**: a video's views divided by the creator's usual (median) views. Daphne's own rule is views ÷ followers ("1M views from a 1k-follower account"). Both point to the same thing: the idea did the work, not the audience.

## Where the gap is

Based on what vendor sites say and don't say. Not proven that competitors lack these features.

1. **Per-client workflow for agencies.** Tools are built for one creator or brand. None mention client workspaces, approvals or tracking. That is Daphne's top pain.
2. **From video to filmable plan.** Tools show the video, and some transcribe it. None produce a shot list and editor brief for a real team.
3. **"Can this client film it?"** Mysocial's fit score is the closest, but it's for your own account, not a client's.
4. **Trends moving between platforms** ("big on TikTok, not yet on Instagram"). No one claims this clearly. The idea that formats move from TikTok to Instagram is widely believed but **unverified**.
5. **Local trends.** No tool mentions filtering by country or city. Daphne's clients are Sydney businesses.

## Risks

- **Data access.** Instagram and TikTok restrict outside access. Most tools use third-party data providers or scraping. Check cost and terms before building on any data source.
- **Price pressure.** Cila is US$24–48/mo. Daphne's agency already avoids paying for it, and earlier content interviews found businesses pay for people, not tools.
- **Crowded space.** Virlo and Mysocial are funded and moving fast, and both already offer MCP connectors for AI assistants.

## Open questions

- Can Cila search by keyword across all of Instagram? Ask Daphne, or try one month (US$12).
- Would Annie (Mercif's founder) pay for workflow on top of research? How much compared to Cila?
- Is there real evidence that formats appear on TikTok before Instagram? Check posting dates on hand-collected "tofu" videos.

## Related

- Hackathon and Daphne prototype plan: `../hackathon-plan-trend-tool.md`
- Daphne interview: `../interviews/2026-10-21-daphene-summary.md`
- Earlier competitor research (AI content generation, different idea): `social-content-competitors.md`
