"""Result ranking — merge postings, apply BM25, sort — stub."""
# TODO: implement BM25-based ranking


def rank(query_tokens: list[str], index, top_k: int = 10) -> list[tuple[str, float]]:
    """Score and rank documents for the given query tokens using BM25."""
    raise NotImplementedError
