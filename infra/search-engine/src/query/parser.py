"""Boolean and phrase query parser — stub."""
# TODO: implement AND, OR, NOT, phrase ("foo bar")


class QueryNode:
    """AST node for a parsed query expression."""
    pass


def parse(query: str) -> QueryNode:
    """Parse a query string into an AST. Supports AND, OR, NOT, phrases."""
    raise NotImplementedError
