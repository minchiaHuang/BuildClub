"""API contract between this backend and the front end. Field names match src/types.ts
(camelCase), so the front end can use the JSON as is. /docs shows these models."""

import math
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints, field_validator


class SearchVideo(BaseModel):
    """One video in a search result, as trimmed from the Apify item."""
    id: str
    text: str
    url: str
    createTime: Optional[str] = None
    # Null on Reddit, which shows no views: upvotes stand in for them.
    plays: Optional[int] = None
    likes: int
    comments: int
    shares: int
    saves: Optional[int] = None
    duration: float
    cover: str
    author: str
    # Null on Instagram: its search results carry no follower counts.
    followers: Optional[int] = None
    music: str
    musicOriginal: bool
    hashtags: list[str]
    # Views ÷ followers, the TikTok sort order (Daphne's rule). Null when followers is.
    ratio: Optional[float] = None
    # The account's usual views (median of its latest videos) and views ÷ that.
    # Null when the account has too few videos, or for searches saved before this existed.
    medianViews: Optional[float] = None
    outlier: Optional[float] = None
    # How many videos the median covers (null on searches saved before baselines were kept).
    medianN: Optional[int] = None
    # Dates (YYYY-MM-DD) of the oldest and newest video in the median.
    baselineFrom: Optional[str] = None
    baselineTo: Optional[str] = None
    # When the median was fetched, in ms since the epoch.
    medianFetchedAt: Optional[int] = None
    # What outlier is measured against: the account's median, or followers when there is no median.
    denominator: Optional[Literal["median", "followers"]] = None
    # YouTube only: the channel, which the usual views are looked up by. Not shown in the app.
    channelId: Optional[str] = None
    # Reddit only: upvotes, the subreddit (without "r/"), and the subreddit's median upvotes over its
    # top posts of the month. outlier is upvotes ÷ medianUpvotes.
    upvotes: Optional[int] = None
    community: Optional[str] = None
    medianUpvotes: Optional[float] = None


class SearchResult(BaseModel):
    query: str
    platform: Literal["tiktok", "instagram", "youtube", "reddit", "x"]
    fetchedAt: int
    videos: list[SearchVideo]
    cached: bool
    # True while account (or subreddit) medians are still being fetched; search again (it's cached) for the scores.
    mediansPending: bool = False


class Client(BaseModel):
    id: str
    name: str
    niche: str
    audience: str
    monthlyTarget: int
    examples: list[str]
    topics: Optional[list[str]] = None
    cannot: list[str]


class Shot(BaseModel):
    time: str
    shot: str
    text: Optional[str] = None


Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class Decision(BaseModel):
    """One answer from the approver. Kept in SavedIdea.history so a resend still shows why it was rejected."""
    decision: Literal["approved", "rejected"]
    reason: Optional[str] = None
    tags: Optional[list[Tag]] = Field(default=None, max_length=5)
    decidedAt: int


class SavedIdea(BaseModel):
    id: str
    videoId: str
    clientId: str
    status: Literal["saved", "waiting", "approved", "rejected"]
    dueDate: str
    notes: str
    shots: Optional[list[Shot]] = None
    noteToApprover: Optional[str] = None
    sentAt: Optional[int] = None
    rejectReason: Optional[str] = None
    rejectTags: Optional[list[Tag]] = Field(default=None, max_length=5)
    decidedAt: Optional[int] = None
    # Daphne's production stage for an approved idea. No stage means "approved".
    stage: Optional[Literal["approved", "filming", "editing", "posted"]] = None
    postedAt: Optional[int] = None
    # Set by the team's tab: when the plan was first approved (kept when "Edit" reopens it), the manager's
    # "approve with changes" note and per-shot comments keyed by shot index.
    approvedAt: Optional[int] = None
    managerNote: Optional[str] = None
    shotComments: Optional[dict[int, str]] = None
    # Every approver answer so far, oldest first. Only the review link appends to it.
    history: Optional[list[Decision]] = None


class NewComment(BaseModel):
    """A note pinned to a second of a plan's reference video."""
    videoId: str
    atSec: float = Field(ge=0, le=86400, allow_inf_nan=False)  # within a day
    text: str = Field(min_length=1, max_length=500)
    author: str = Field(min_length=1, max_length=60)

    @field_validator("atSec", mode="before")
    @classmethod
    def _finite(cls, v):
        # Swap NaN/Infinity for an out-of-range number: the 422 echoes the input, and JSON can't carry them.
        if isinstance(v, float) and not math.isfinite(v):
            return -1.0
        return v


class Comment(NewComment):
    id: str
    ideaId: str
    createdAt: int
    # Set by the server from the route used, never by the client. Older stored comments have none and
    # count as "review", so a typed name is never shown as staff.
    source: Literal["staff", "review"] = "review"


class Pattern(BaseModel):
    """A sound or hashtag shared by several accounts in a search (Pattern in src/lib/live.ts)."""
    kind: Literal["sound", "hashtag"]
    label: str
    accounts: int
    avgScore: float
    videoIds: list[str]


class Breakout(BaseModel):
    hook: str
    score: float


class Pulse(BaseModel):
    """One client's last "Trending now" check (Pulse in src/lib/clientChips.ts)."""
    topic: str
    fetchedAt: int
    patterns: list[Pattern]
    breakouts: list[Breakout]


class Library(BaseModel):
    """The real videos and formats (with their breakdowns) that saved ideas point to. The front
    end owns their shape (Video and Format in src/types.ts), so they are stored as given."""
    videos: list[dict]
    formats: list[dict]


class Why(BaseModel):
    hook: str
    first3s: str
    length: str
    format: str
    sound: str


class Line(BaseModel):
    """One spoken or on-screen line and the job it does in the video."""
    time: str
    text: str
    role: Literal["hook", "setup", "proof", "payoff", "cta"]


class Breakdown(BaseModel):
    """AI analysis of one video. The first four fields fill the matching Format fields."""
    shotList: list[Shot]
    why: Why
    props: list[str]
    editorNotes: str
    lines: list[Line]
    # What the client needs to film it, chosen from a fixed list. Empty on breakdowns saved before this existed.
    needs: list[str] = []


class AnalyzeRequest(BaseModel):
    url: str
    # The things a client may be unable to do; the breakdown picks its needs from this list only.
    needs: list[str] = []


class NeedsRequest(BaseModel):
    url: str
    needs: list[str] = []


class NeedsResult(BaseModel):
    needs: list[str]


class LikeRequest(BaseModel):
    url: str


class LikeImageRequest(BaseModel):
    image: str  # base64 of the file, without a data: prefix
    mediaType: Literal["image/png", "image/jpeg", "image/webp"]


class LikeImageResult(BaseModel):
    keywords: list[str]
    formatName: str
    description: str


class AnswerVideo(BaseModel):
    id: str = Field(max_length=100)
    platform: str = Field(max_length=30)
    hook: str = Field(max_length=300)
    views: int
    outlier: Optional[float] = None
    hashtags: list[Annotated[str, StringConstraints(max_length=60)]] = Field(default=[], max_length=30)
    music: str = Field(default="", max_length=200)


class AnswerRequest(BaseModel):
    query: str = Field(max_length=200)
    videos: list[AnswerVideo] = Field(max_length=30)


class AnswerResult(BaseModel):  # same fields as the front end's Answer (src/lib/answer.ts)
    lines: list[str]
    basis: str


class LikeJob(BaseModel):
    status: Literal["queued", "running", "done", "failed"]
    step: str = ""
    error: Optional[str] = None
    breakdown: Optional[Breakdown] = None
    # 1-3 search keywords and a short format name, taken from the real video's breakdown.
    keywords: Optional[list[str]] = None
    formatName: Optional[str] = None


class AnalyzeStarted(BaseModel):
    job: str


class ChannelRequest(BaseModel):
    platform: Literal["youtube", "tiktok", "instagram"]
    # A handle ("@name") or a channel / profile link.
    handle: str
    # Newest N videos to decode. 50 by default; 100 only when asked for.
    maxVideos: int = 50


class ChannelStarted(BaseModel):
    job: str


class ChannelJob(BaseModel):
    job: str
    status: Literal["queued", "running", "done", "failed"]
    # What the job is doing now, e.g. "Transcribing speech".
    step: str = ""
    # All the steps this job goes through, in order, and the index of the current one.
    steps: list[str] = []
    stepIndex: int = 0
    # Videos finished in the current step (details and transcripts); 0 of 0 when the step is not counted.
    done: int = 0
    total: int = 0
    # channel-decoder's analysis.json: {summary, videos, formats}. Thumbnails point at this API.
    result: Optional[dict] = None
    error: Optional[str] = None


class AnalyzeJob(BaseModel):
    job: str
    status: Literal["queued", "running", "done", "failed"]
    # 0 to 1, for a progress bar.
    progress: float
    # What the job is doing now, e.g. "Reading the transcript".
    step: str = ""
    result: Optional[Breakdown] = None
    error: Optional[str] = None


class ShareRequest(BaseModel):
    clientId: str


class ShareLink(BaseModel):
    """What the store keeps under share:<token>."""
    clientId: str
    createdAt: int


class ShareCreated(BaseModel):
    token: str
    url: str


class ReviewClient(BaseModel):
    name: str


class ReviewIdea(BaseModel):
    """A SavedIdea as the approver sees it: without `notes`, Daphne's private note to her editor."""
    id: str
    videoId: str
    clientId: str
    status: Literal["saved", "waiting", "approved", "rejected"]
    dueDate: str
    shots: Optional[list[Shot]] = None
    noteToApprover: Optional[str] = None
    sentAt: Optional[int] = None
    rejectReason: Optional[str] = None
    rejectTags: Optional[list[Tag]] = Field(default=None, max_length=5)
    decidedAt: Optional[int] = None
    history: Optional[list[Decision]] = None


class ReviewItem(BaseModel):
    idea: ReviewIdea
    video: Optional[dict] = None
    format: Optional[dict] = None


class ReviewList(BaseModel):
    client: ReviewClient
    ideas: list[ReviewItem]


class DecideRequest(BaseModel):
    ideaId: str
    decision: Literal["approved", "rejected"]
    reason: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[list[Tag]] = Field(default=None, max_length=5)


class LoginRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)
