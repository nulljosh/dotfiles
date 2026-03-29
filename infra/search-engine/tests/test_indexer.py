"""Tests for tokenizer and inverted index."""
from src.indexer.tokenizer import tokenize
from src.indexer.index import InvertedIndex


def test_tokenize_basic():
    assert tokenize("Hello World") == ["hello", "world"]


def test_tokenize_punctuation():
    assert tokenize("foo, bar.") == ["foo", "bar"]


def test_tokenize_empty():
    assert tokenize("") == []


def test_index_add_and_search():
    idx = InvertedIndex()
    idx.add_document("doc1", "the quick brown fox")
    idx.add_document("doc2", "the lazy dog")
    results = idx.search("fox")
    assert results[0][0] == "doc1"


def test_index_tfidf_ranking():
    idx = InvertedIndex()
    idx.add_document("doc1", "python python python")
    idx.add_document("doc2", "python java")
    results = idx.search("python")
    assert results[0][0] == "doc1"


def test_index_no_results():
    idx = InvertedIndex()
    idx.add_document("doc1", "hello world")
    assert idx.search("zzz") == []


def test_index_save_load(tmp_path):
    idx = InvertedIndex()
    idx.add_document("doc1", "save and load")
    path = str(tmp_path / "index.json")
    idx.save(path)
    loaded = InvertedIndex.load(path)
    assert loaded.doc_count == 1
    assert loaded.search("save")[0][0] == "doc1"
