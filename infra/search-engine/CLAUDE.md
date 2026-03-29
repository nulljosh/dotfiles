# Search Engine — Claude Notes

## Overview

Local text search engine — inverted index, TF-IDF/BM25, optional web crawler.

## Stack

Python 3.10+, beautifulsoup4 (crawl), flask (API), nltk (stemming), requests (HTTP)

## Module Breakdown

| Module | File | Purpose | Status |
|--------|------|---------|--------|
| Tokenizer | src/indexer/tokenizer.py | regex split, lowercase | working (4 LOC) |
| Inverted Index | src/indexer/index.py | term → doc mapping, TF tracking | working (74 LOC) |
| BM25 Scoring | src/indexer/tfidf.py | BM25 + TF-IDF scoring | done |
| Query Parser | src/query/parser.py | AND/OR/NOT/phrases | done |
| Ranker | src/query/ranker.py | merge + rank results | done |
| Search CLI | src/query/search.py | load index, run query | done |
| Crawler | src/crawler/crawler.py | BFS, depth-limited | done |
| robots.txt | src/crawler/robots.py | crawl permissions | done |
| Document Store | src/storage/store.py | JSON persistence | done |
| REST API | src/server/api.py | /search + /index | done |

## Architecture

```
Crawler → Tokenizer → Inverted Index → Document Store
                             ↓
                       Query Parser → BM25 Ranker → REST API
```

## Running

```bash
# Build index
python -m src.indexer.index data/

# Search
python -m src.query.search "your query"

# Run tests
python -m pytest tests/
```

## Extension Points

- Replace TF-IDF with BM25 in `src/indexer/tfidf.py` (K1=1.5, B=0.75 constants already set)
- Swap JSON store for key-value-store backend in `src/storage/store.py`
- Add query-language SQL frontend via `src/query/parser.py`
- Add PageRank to crawler for link-graph-based scoring

## Status

Complete. All modules implemented: BM25 scoring, boolean query parser (AND/OR/NOT/phrases), BFS crawler with robots.txt, JSON document store, Flask REST API. 28 tests passing.
