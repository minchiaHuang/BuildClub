"""API contract between this backend and the front end. Field names match src/types.ts
(camelCase), so the front end can use the JSON as is. /docs shows these models."""

from typing import Literal, Optional

from pydantic import BaseModel


class SearchVideo(BaseModel):
    """One video in a search result, as trimmed from the Apify item."""
    id: str
    text: str
    url: str
    createTime: Optional[str] = None
    plays: int
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
    # YouTube only: the channel, which the usual views are looked up by. Not shown in the app.
    channelId: Optional[str] = None


class SearchResult(BaseModel):
    query: str
    platform: Literal["tiktok", "instagram", "youtube"]
    fetchedAt: int
    videos: list[SearchVideo]
    cached: bool
    # True while account medians are still being fetched; search again (it's cached) for the scores.
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


class AnalyzeRequest(BaseModel):
    url: str


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
