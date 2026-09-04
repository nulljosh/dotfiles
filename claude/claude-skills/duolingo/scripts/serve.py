#!/usr/bin/env python3
"""Serve duo.js to the Duolingo tab.

Pasting the solver through javascript_tool costs ~50k tokens per reload and the
page/disk copies drift apart. http://localhost is a "potentially trustworthy
origin", so an https page may fetch it without tripping mixed-content blocking —
CORS is the only header we need to add.
"""
import http.server, os, sys

D = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=D, **k)
    def end_headers(self):
        # Chrome blocks public https -> private localhost unless the server opts in
        # to the Private Network Access handshake. Without this header the request
        # hangs with no error at all.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        super().end_headers()

    def do_POST(self):
        # boot.js posts duoAuto + the ledger after every lesson -> state.json on disk.
        # Status checks then read a file instead of driving the browser.
        n = int(self.headers.get('Content-Length', 0))
        name = 'hb.json' if self.path == '/hb' else 'state.json'
        with open(os.path.join(D, name), 'wb') as f: f.write(self.rfile.read(n))
        self.send_response(204); self.end_headers()
    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()
    def log_message(self, *a): pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
