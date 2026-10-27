"""API contract between this backend and the front end. Field names match src/types.ts
(camelCase), so the front end can use the JSON as is. /docs shows these models."""

from typing import Literal, Optional

from pydantic import BaseModel


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


class AnalyzeJob(BaseModel):
    job: str
    status: Literal["queued", "running", "done", "failed"]
    # 0 to 1, for a progress bar.
    progress: float
    # What the job is doing now, e.g. "Reading the transcript".
    step: str = ""
    result: Optional[Breakdown] = None
    error: Optional[str] = None
