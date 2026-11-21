"""BM25 and TF-IDF scoring — stub."""
# TODO: implement BM25

K1 = 1.5   # term frequency saturation
B = 0.75   # length normalization


def bm25_score(tf: int, df: int, doc_count: int, doc_len: int, avg_doc_len: float) -> float:
    """Compute BM25 score for a single term in a document."""
    raise NotImplementedError


def tfidf_score(tf: int, df: int, doc_count: int) -> float:
    """Compute TF-IDF score for a single term."""
    raise NotImplementedError
