"""Document store — JSON persistence for raw document content — stub."""
# TODO: implement
from __future__ import annotations
import json
from pathlib import Path


class DocumentStore:
    """Persist and retrieve raw document text by doc_id."""

    def __init__(self, path: str = "store.json"):
        self.path = Path(path)
        self._data: dict[str, str] = {}

    def add(self, doc_id: str, text: str):
        """Store raw text for a document."""
        raise NotImplementedError

    def get(self, doc_id: str) -> str | None:
        """Retrieve raw text for a document."""
        raise NotImplementedError

    def save(self):
        """Persist store to disk as JSON."""
        raise NotImplementedError

    def load(self):
        """Load store from disk."""
        raise NotImplementedError
