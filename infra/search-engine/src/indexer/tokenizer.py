"""Text tokenization — regex split, lowercasing, stop word removal."""
import re


def tokenize(text: str) -> list[str]:
    return re.findall(r'\w+', text.lower())
