#!/usr/bin/env python3
"""Static server with HTTP Range (required for PMTiles). Windows-friendly."""

from __future__ import annotations

import argparse
import os
import socketserver
from http.server import SimpleHTTPRequestHandler


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None

        ctype = self.guess_type(path)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            fs = os.fstat(f.fileno())
            size = fs.st_size
            range_header = self.headers.get("Range")
            if range_header:
                # bytes=start-end
                units, _, spec = range_header.partition("=")
                if units.strip() != "bytes":
                    self.send_error(400, "Invalid Range")
                    f.close()
                    return None
                start_s, _, end_s = spec.strip().partition("-")
                try:
                    start = int(start_s) if start_s else 0
                    end = int(end_s) if end_s else size - 1
                except ValueError:
                    self.send_error(400, "Invalid Range")
                    f.close()
                    return None
                if start < 0 or end >= size or start > end:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    f.close()
                    return None
                length = end - start + 1
                f.seek(start)
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                return _RangedFile(f, length)

            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(size))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        except Exception:
            f.close()
            raise


class _RangedFile:
    def __init__(self, f, length: int):
        self._f = f
        self._remaining = length

    def read(self, n: int = -1):
        if self._remaining <= 0:
            return b""
        if n < 0 or n > self._remaining:
            n = self._remaining
        data = self._f.read(n)
        self._remaining -= len(data)
        return data

    def close(self):
        self._f.close()


def main():
    parser = argparse.ArgumentParser(description="Serve public/ with Range support")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument(
        "--dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="document root (default: this script's directory)",
    )
    args = parser.parse_args()
    os.chdir(args.dir)

    with socketserver.ThreadingTCPServer(("", args.port), RangeRequestHandler) as httpd:
        httpd.allow_reuse_address = True
        print(f"Serving {args.dir} at http://127.0.0.1:{args.port}/ (Range OK)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")


if __name__ == "__main__":
    main()
