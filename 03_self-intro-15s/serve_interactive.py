"""Launch the interactive 60fps WebGL2 + WebAudio Director's Cut of ANTIGRAVITY in your browser."""
import webbrowser
from render_film import start_local_server

if __name__ == "__main__":
    port = 8799
    srv = start_local_server(port)
    url = f"http://127.0.0.1:{port}/index.html"
    print(f"ANTIGRAVITY Interactive Director's Cut running at -> {url}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
