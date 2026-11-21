"""Search engine — inverted index builder."""
import json
import math
import os
import sys
from collections import defaultdict

from .tokenizer import tokenize


class InvertedIndex:
    def __init__(self):
        self.index: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.doc_lengths: dict[str, int] = {}
        self.doc_count = 0

    def add_document(self, doc_id: str, text: str):
        tokens = tokenize(text)
        self.doc_lengths[doc_id] = len(tokens)
        self.doc_count += 1
        for token in tokens:
            self.index[token][doc_id] += 1

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        tokens = tokenize(query)
        scores: dict[str, float] = defaultdict(float)
        for token in tokens:
            if token not in self.index:
                continue
            df = len(self.index[token])
            idf = math.log((self.doc_count + 1) / (df + 1))
            for doc_id, tf in self.index[token].items():
                scores[doc_id] += tf * idf
        ranked = sorted(scores.items(), key=lambda x: -x[1])
        return ranked[:top_k]

    def save(self, path: str):
        data = {"index": dict(self.index), "doc_lengths": self.doc_lengths, "doc_count": self.doc_count}
        with open(path, "w") as f:
            json.dump(data, f)

    @classmethod
    def load(cls, path: str):
        obj = cls()
        with open(path) as f:
            data = json.load(f)
        obj.index = defaultdict(lambda: defaultdict(int), data["index"])
        obj.doc_lengths = data["doc_lengths"]
        obj.doc_count = data["doc_count"]
        return obj


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.indexer.index <docs_directory>")
        sys.exit(1)
    idx = InvertedIndex()
    docs_dir = sys.argv[1]
    for fname in os.listdir(docs_dir):
        path = os.path.join(docs_dir, fname)
        if os.path.isfile(path):
            with open(path) as f:
                idx.add_document(fname, f.read())
            print(f"Indexed: {fname}")
    idx.save("index.json")
    print(f"Done. {idx.doc_count} documents indexed.")


if __name__ == "__main__":
    main()
