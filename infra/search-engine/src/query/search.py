"""Query the inverted index."""
import sys

from ..indexer.index import InvertedIndex


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.query.search <query>")
        sys.exit(1)
    idx = InvertedIndex.load("index.json")
    query = " ".join(sys.argv[1:])
    results = idx.search(query)
    if not results:
        print("No results.")
        return
    for rank, (doc_id, score) in enumerate(results, 1):
        print(f"{rank}. {doc_id} (score: {score:.4f})")


if __name__ == "__main__":
    main()
