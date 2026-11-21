"""Tests for DocumentStore."""
import pytest
from src.storage.store import DocumentStore


def test_store_not_implemented_add(tmp_path):
    store = DocumentStore(str(tmp_path / "store.json"))
    with pytest.raises(NotImplementedError):
        store.add("doc1", "hello world")


def test_store_not_implemented_get(tmp_path):
    store = DocumentStore(str(tmp_path / "store.json"))
    with pytest.raises(NotImplementedError):
        store.get("doc1")


def test_store_not_implemented_save(tmp_path):
    store = DocumentStore(str(tmp_path / "store.json"))
    with pytest.raises(NotImplementedError):
        store.save()


def test_store_not_implemented_load(tmp_path):
    store = DocumentStore(str(tmp_path / "store.json"))
    with pytest.raises(NotImplementedError):
        store.load()


def test_store_init_sets_path(tmp_path):
    path = str(tmp_path / "mystore.json")
    store = DocumentStore(path)
    assert str(store.path) == path


def test_store_default_path():
    store = DocumentStore()
    assert store.path.name == "store.json"
