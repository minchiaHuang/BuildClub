"""Small Claude helpers that describe real videos. They never write scripts or new content.
Every Claude call goes through call_claude, so tests replace that one function."""

import json
import re

import anthropic

CHEAP_MODEL = "claude-haiku-5-5"


def call_claude(model: str, system: str, content: list, max_tokens: int) -> str:
    """One plain Claude call; returns the text of the answer."""
    response = anthropic.Anthropic().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": content}],
    )
    return "".join(b.text for b in response.content if getattr(b, "type", "") == "text")


def pick_needs(breakdown: dict, vocab: list[str]) -> list[str]:
    """Which items of vocab a video needs, judged from its saved breakdown (shots, props, why)."""
    facts = {
        "shotList": breakdown.get("shotList", []),
        "props": breakdown.get("props", []),
        "why": breakdown.get("why", {}),
    }
    system = ("You read a description of a real video and say what a client would need in order to film "
              "something similar. You only describe; you never write scripts or new content. "
              "Answer with a JSON array of strings chosen only from the list given, and nothing else.")
    text = f"Choose from this list: {json.dumps(vocab)}\n\nThe video:\n{json.dumps(facts, ensure_ascii=False)}"
    answer = call_claude(CHEAP_MODEL, system, [{"type": "text", "text": text}], 300)
    found = re.search(r"\[.*?\]", answer, re.S)
    try:
        picked = json.loads(found.group(0)) if found else []
    except ValueError:
        picked = []
    return [n for n in vocab if n in picked]


def like_terms(breakdown: dict) -> tuple[list[str], str]:
    """1-3 search keywords and a short format name that describe a real video, from its saved breakdown."""
    facts = {
        "shotList": breakdown.get("shotList", []),
        "props": breakdown.get("props", []),
        "why": breakdown.get("why", {}),
    }
    system = ("You read a description of a real video and say what it is about, so someone can search for "
              "similar videos. You only describe; you never write scripts, captions or new content. "
              'Answer with JSON only: {"keywords": [1 to 3 short search phrases], "formatName": "a 2 to 4 word name '
              'for the video\'s format"}.')
    answer = call_claude(CHEAP_MODEL, system, [{"type": "text", "text": json.dumps(facts, ensure_ascii=False)}], 300)
    keywords, name, _ = parse_terms(answer)
    return keywords, name


def parse_terms(answer: str) -> tuple[list[str], str, str]:
    """(keywords, formatName, description) from an answer holding a JSON object. Raises ValueError without keywords."""
    found = re.search(r"\{.*\}", answer, re.S)
    try:
        data = json.loads(found.group(0)) if found else {}
    except ValueError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    raw = data.get("keywords")
    keywords = [k.strip() for k in raw if isinstance(k, str) and k.strip()][:3] if isinstance(raw, list) else []
    if not keywords:
        raise ValueError("no keywords in the answer")
    name, description = data.get("formatName"), data.get("description")
    return (keywords, name.strip() if isinstance(name, str) and name.strip() else keywords[0],
            description.strip() if isinstance(description, str) else "")


def like_image_terms(image: str, media_type: str) -> tuple[list[str], str, str]:
    """Search keywords, a format name and a one-sentence description of what a screenshot of a video shows."""
    system = ("You look at a screenshot of a video and say what it shows, so someone can search for similar "
              "videos. Only describe what is visible: the subject, the setting, the style. Do not write a script, "
              "captions or any new content, and do not guess at what is not shown. "
              'Answer with JSON only: {"keywords": [1 to 3 short search phrases], "formatName": "a 2 to 4 word name '
              'for the video\'s format", "description": "one sentence on what the screenshot shows"}.')
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image}},
        {"type": "text", "text": "What does this screenshot show?"},
    ]
    return parse_terms(call_claude(CHEAP_MODEL, system, content, 300))
