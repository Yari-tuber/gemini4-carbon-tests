"""Hardware-accelerated WebGL2 + Editorial Typography 1920x1080@60fps Cinema Renderer for ANTIGRAVITY (15.000s)."""
import argparse
import base64
import http.server
import mimetypes
import shutil
import socketserver
import subprocess
import threading
import time
from pathlib import Path
import cv2
import numpy as np
from playwright.sync_api import sync_playwright

FILM_DIR = Path(__file__).resolve().parent
ROOT_DIR = FILM_DIR.parent
THREE_DIR = ROOT_DIR / "node_modules" / "three"
FFMPEG_BIN = "ffmpeg"    # public repo: was an absolute path to ffmpeg on the author's PC
FFPROBE_BIN = "ffprobe"  # public repo: same

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("text/css", ".css")


class FilmHTTPHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send_file(self, fp: Path):
        if not fp.exists() or not fp.is_file():
            self.send_response(404)
            self.end_headers()
            return
        ctype, _ = mimetypes.guess_type(str(fp))
        if not ctype:
            ctype = "application/octet-stream"
        data = fp.read_bytes()
        try:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(data)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def do_GET(self):
        raw_path = self.path.split("?")[0]
        if raw_path in ("/", "/index.html"):
            self._send_file(FILM_DIR / "index.html")
            return
        if raw_path.startswith("/vendor/three/"):
            rel = raw_path[len("/vendor/three/"):]
            self._send_file((THREE_DIR / rel).resolve())
            return
        rel = raw_path.lstrip("/")
        self._send_file((FILM_DIR / rel).resolve())


def start_local_server(port: int):
    class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    srv = ThreadedHTTPServer(("127.0.0.1", port), FilmHTTPHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="Render 16-frame contact sheet + 4 1080p hero stills")
    ap.add_argument("--full", action="store_true", help="Render full 900-frame 1920x1080@60fps master MP4")
    ap.add_argument("--port", type=int, default=8794)
    ap.add_argument("--shutter", type=float, default=0.45, help="Cinema 162-deg shutter fraction")
    args = ap.parse_args()

    srv = start_local_server(args.port)
    url = f"http://127.0.0.1:{args.port}/index.html?render=1"
    print(f"Started local Film Asset Server -> {url}", flush=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--use-angle=d3d11",
                "--enable-gpu",
                "--ignore-gpu-blocklist",
                "--enable-webgl",
                "--enable-webgl2",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
            ],
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.on("console", lambda msg: print(f"[console:{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: print(f"[pageerror] {err}"))

        page.goto(url)
        page.wait_for_function("window.__film && window.__film.ready === true", timeout=60000)
        print("WebGL2 + Editorial Typography Engine Ready!", flush=True)

        clip = {"x": 0, "y": 0, "width": 1920, "height": 1080}

        if args.preview:
            hero_times = [
                ("still_act1.png", 2.40),
                ("still_act2.png", 6.10),
                ("still_act3.png", 9.35),
                ("still_act4.png", 13.30),
            ]
            for fname, ht in hero_times:
                page.evaluate(f"window.__film.setTime({ht})")
                png_bytes = page.screenshot(type="png", clip=clip)
                (FILM_DIR / fname).write_bytes(png_bytes)
                print(f"  Saved 1080p hero still -> {fname} (t={ht:.2f}s)", flush=True)

            grid_ts = [
                0.35, 0.88, 1.65, 2.65,
                3.68, 4.75, 6.10, 7.22,
                7.52, 8.60, 9.80, 10.90,
                11.45, 12.60, 13.80, 14.65,
            ]
            thumbs = []
            for gt in grid_ts:
                page.evaluate(f"window.__film.setTime({gt})")
                raw = page.screenshot(type="jpeg", quality=94, clip=clip)
                img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
                sm = cv2.resize(img, (480, 270), interpolation=cv2.INTER_AREA)
                cv2.rectangle(sm, (8, 8), (118, 36), (10, 10, 14), -1)
                cv2.putText(sm, f"t={gt:05.2f}s", (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (220, 195, 150), 1, cv2.LINE_AA)
                thumbs.append(sm)
            sheet = np.vstack([np.hstack(thumbs[r * 4:(r + 1) * 4]) for r in range(4)])
            sheet_path = FILM_DIR / "preview_16frames.jpg"
            cv2.imwrite(str(sheet_path), sheet, [cv2.IMWRITE_JPEG_QUALITY, 94])
            print(f"Saved 16-frame 1920x1080 storyboard sheet -> {sheet_path}", flush=True)

        if args.full:
            fps = 60
            n_frames = 900  # Exact 15.000 seconds @ 60.00 fps
            dur = 15.000
            audio_wav = FILM_DIR / "audio_master.wav"
            out_master = FILM_DIR / "antigravity_15s_master.mp4"
            out_root = ROOT_DIR / "antigravity_self_intro_15s.mp4"

            cdp = page.context.new_cdp_session(page)

            def grab_frame_jpg(t_val: float, q: int = 97) -> bytes:
                page.evaluate(
                    "t => { window.__film.setTime(t); return new Promise(r => requestAnimationFrame(() => r())); }",
                    t_val,
                )
                res = cdp.send(
                    "Page.captureScreenshot",
                    {
                        "format": "jpeg",
                        "quality": q,
                        "clip": {"x": 0, "y": 0, "width": 1920, "height": 1080, "scale": 1},
                    },
                )
                return base64.b64decode(res["data"])

            cmd = [
                FFMPEG_BIN, "-y", "-loglevel", "error",
                "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                "-i", str(audio_wav),
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                "-pix_fmt", "yuv420p",
                "-r", str(fps),
                "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                "-t", "15.000",
                "-movflags", "+faststart",
                str(out_master),
            ]
            ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            t_start = time.time()

            for i in range(n_frames):
                t = i / fps
                sub_k = int(page.evaluate(f"window.__film.motionSubframes({t})"))
                if sub_k <= 1:
                    jpg = grab_frame_jpg(t, 97)
                else:
                    acc = None
                    for s in range(sub_k):
                        offset = ((s / (sub_k - 1)) - 0.5) * (args.shutter / fps)
                        ts = max(0.0, min(dur, t + offset))
                        raw = grab_frame_jpg(ts, 96)
                        arr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR).astype(np.float32)
                        acc = arr if acc is None else acc + arr
                    blended = np.clip(acc / sub_k, 0, 255).astype(np.uint8)
                    jpg = cv2.imencode(".jpg", blended, [cv2.IMWRITE_JPEG_QUALITY, 97])[1].tobytes()

                ff.stdin.write(jpg)
                if i % 90 == 0 or i == n_frames - 1:
                    el = time.time() - t_start
                    eta = (el / (i + 1)) * (n_frames - i - 1)
                    print(f"  Frame {i + 1:3d}/{n_frames} (t={t:5.2f}s) | elapsed={el:4.1f}s | eta={eta:4.1f}s", flush=True)

            ff.stdin.close()
            ret = ff.wait()
            if ret != 0:
                raise RuntimeError(f"FFmpeg exited with code {ret}")

            shutil.copy2(out_master, out_root)
            print(f"Master 15.000s 1080p60 film rendered -> {out_root}", flush=True)

            probe = subprocess.check_output([
                FFPROBE_BIN, "-v", "error",
                "-show_entries", "format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,nb_frames",
                "-of", "default=noprint_wrappers=1",
                str(out_root),
            ], text=True)
            print("--- FFPROBE VERIFICATION ---\n" + probe.strip(), flush=True)

        browser.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
