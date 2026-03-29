# Setup

## Dependencies

- Python 3.10+
- beautifulsoup4 (web crawling)
- flask (REST API)
- nltk (stemming, optional)
- requests (HTTP fetching)

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
# Add documents to data/
echo "Hello world" > data/sample.txt

# Index documents
python -m src.indexer.index data/

# Search
python -m src.query.search "hello"

# Run tests
python -m pytest tests/
```

## Module Paths

| Old path | New path |
|----------|----------|
| src/index.py | src/indexer/index.py |
| src/search.py | src/query/search.py |
