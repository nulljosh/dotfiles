"""REST API — Flask HTTP endpoint for search queries — stub."""
# TODO: implement
# GET /search?q=<query>&top_k=10 → JSON list of {doc_id, score}


def create_app(index_path: str = "index.json"):
    """Build and return a Flask app with a /search endpoint."""
    raise NotImplementedError


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
