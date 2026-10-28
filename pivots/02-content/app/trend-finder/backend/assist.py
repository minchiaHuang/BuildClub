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
