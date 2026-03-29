"""BFS web crawler — fetches pages and follows links up to a depth limit."""
# TODO: implement


class Crawler:
    """BFS link crawler. Checks robots.txt before fetching each URL."""

    def __init__(self, seed_urls: list[str], max_depth: int = 2):
        self.seed_urls = seed_urls
        self.max_depth = max_depth
        self.visited: set[str] = set()

    def crawl(self):
        """Run BFS from seed_urls, yielding (url, text) tuples."""
        raise NotImplementedError
