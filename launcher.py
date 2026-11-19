"""
RAG Stack Launcher — one-click start/stop for the whole platform.

Run:  backend\venv\Scripts\pythonw.exe launcher.py   (or double-click "RAG Launcher.bat")

Starts, in order:
  1. WSL Ubuntu VM (PostgreSQL + Redis auto-start via systemd inside)
  2. FastAPI backend  (uvicorn, port 8000)
  3. Celery worker    (document ingestion)
  4. Next.js frontend (port 3000)

Service output goes to logs/*.log. Ollama is expected to already be running
as a Windows app (status light only).
"""
import ctypes
import os
import socket
import subprocess
import threading
import time
import tkinter as tk
from tkinter import messagebox, scrolledtext
import webbrowser

# ---- crisp text on high-DPI displays (must run before Tk is created) ----
try:
    ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))  # Per-Monitor v2
except (AttributeError, OSError):
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        pass

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
VENV_PY = os.path.join(BACKEND, "venv", "Scripts", "python.exe")
LOGS = os.path.join(ROOT, "logs")
CREATE_NO_WINDOW = 0x08000000

# palette
BG = "#0b0e14"
CARD = "#131826"
CARD_EDGE = "#1e2536"
TEXT = "#e6e9f2"
MUTED = "#7d879f"
GREEN = "#22c55e"
GRAY = "#4b5266"
BLUE = "#2563eb"
BLUE_HOVER = "#3b82f6"
DARKBTN = "#1c2333"
DARKBTN_HOVER = "#273049"

SERVICES = [
    # key, label, host, port
    ("postgres", "PostgreSQL  ·  WSL", "127.0.0.1", 5432),
    ("redis", "Redis  ·  WSL", "127.0.0.1", 6379),
    ("backend", "Backend API  ·  :8000", "127.0.0.1", 8000),
    ("celery", "Celery worker", None, None),  # no port — tracked by process
    ("frontend", "Frontend  ·  :3000", "127.0.0.1", 3000),
    ("ollama", "Ollama LLM  ·  :11434", "127.0.0.1", 11434),
]


def port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


class Launcher(tk.Tk):
    def __init__(self):
        super().__init__()
        # scale Tk's coordinate system to the real DPI so fonts render sharp
        dpi = self.winfo_fpixels("1i")
        self.tk.call("tk", "scaling", dpi / 72.0)

        self.title("Citely Launcher")
        self.configure(bg=BG)
        self.minsize(520, 560)
        self.geometry("560x680")
        self.procs: dict[str, subprocess.Popen] = {}
        self.busy = False
        os.makedirs(LOGS, exist_ok=True)
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self._poll_status()

    # ---------- UI ----------
    def _build_ui(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(3, weight=1)  # log pane absorbs extra height

        # header
        header = tk.Frame(self, bg=BG)
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=(18, 10))
        tk.Label(header, text="Citely", bg=BG, fg=TEXT,
                 font=("Segoe UI Semibold", 16)).pack(anchor="w")
        tk.Label(header, text="Ollama  ·  pgvector  ·  Hybrid retrieval", bg=BG, fg=MUTED,
                 font=("Segoe UI", 10)).pack(anchor="w")

        # services card
        card = tk.Frame(self, bg=CARD, highlightbackground=CARD_EDGE, highlightthickness=1)
        card.grid(row=1, column=0, sticky="ew", padx=20)
        card.columnconfigure(1, weight=1)
        self.dots: dict[str, tk.Canvas] = {}
        self.states: dict[str, tk.Label] = {}
        for i, (key, label, _, _) in enumerate(SERVICES):
            dot = tk.Canvas(card, width=12, height=12, bg=CARD, highlightthickness=0)
            dot.grid(row=i, column=0, sticky="w", padx=(16, 10), pady=(12 if i == 0 else 5, 12 if i == len(SERVICES) - 1 else 5))
            tk.Label(card, text=label, bg=CARD, fg=TEXT, font=("Segoe UI", 11),
                     anchor="w").grid(row=i, column=1, sticky="ew")
            state = tk.Label(card, text="stopped", bg=CARD, fg=MUTED, font=("Segoe UI", 9), anchor="e")
            state.grid(row=i, column=2, sticky="e", padx=(0, 16))
            self.dots[key] = dot
            self.states[key] = state
            self._set_dot(key, False)

        # buttons — stretch across the window
        btns = tk.Frame(self, bg=BG)
        btns.grid(row=2, column=0, sticky="ew", padx=20, pady=14)
        for c in range(3):
            btns.columnconfigure(c, weight=1, uniform="btns")
        self.btn_start = self._button(btns, "▶   Start All", BLUE, BLUE_HOVER, "white", self.start_all)
        self.btn_start.grid(row=0, column=0, sticky="ew", padx=(0, 6), ipady=9)
        self.btn_stop = self._button(btns, "⏹   Stop All", DARKBTN, DARKBTN_HOVER, TEXT, self.stop_all)
        self.btn_stop.grid(row=0, column=1, sticky="ew", padx=6, ipady=9)
        self.btn_open = self._button(btns, "🌐   Open App", DARKBTN, DARKBTN_HOVER, TEXT,
                                     lambda: webbrowser.open("http://localhost:3000"))
        self.btn_open.grid(row=0, column=2, sticky="ew", padx=(6, 0), ipady=9)

        # activity log — grows with the window
        logwrap = tk.Frame(self, bg=CARD, highlightbackground=CARD_EDGE, highlightthickness=1)
        logwrap.grid(row=3, column=0, sticky="nsew", padx=20)
        logwrap.columnconfigure(0, weight=1)
        logwrap.rowconfigure(1, weight=1)
        tk.Label(logwrap, text="ACTIVITY", bg=CARD, fg=MUTED, font=("Segoe UI Semibold", 8),
                 anchor="w").grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 2))
        self.log = scrolledtext.ScrolledText(logwrap, bg=CARD, fg="#a6b0c9",
                                             font=("Cascadia Mono", 9), relief="flat",
                                             state="disabled", height=8, wrap="word",
                                             insertbackground=TEXT)
        self.log.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        # footer links
        footer = tk.Frame(self, bg=BG)
        footer.grid(row=4, column=0, sticky="ew", padx=20, pady=(8, 14))
        footer.columnconfigure(1, weight=1)
        self._link(footer, "Open logs folder", lambda: os.startfile(LOGS)).grid(row=0, column=0, sticky="w")
        self._link(footer, "API docs", lambda: webbrowser.open("http://localhost:8000/docs")).grid(row=0, column=2, sticky="e")

    def _button(self, parent, text, bg, hover, fg, cmd) -> tk.Button:
        b = tk.Button(parent, text=text, bg=bg, fg=fg, activebackground=hover,
                      activeforeground="white", font=("Segoe UI Semibold", 10),
                      relief="flat", cursor="hand2", bd=0, command=cmd)
        b.bind("<Enter>", lambda e: b.configure(bg=hover))
        b.bind("<Leave>", lambda e: b.configure(bg=bg))
        return b

    def _link(self, parent, text, cmd) -> tk.Button:
        return tk.Button(parent, text=text, bg=BG, fg=MUTED, activebackground=BG,
                         activeforeground=TEXT, relief="flat", bd=0, cursor="hand2",
                         font=("Segoe UI", 9, "underline"), command=cmd)

    def _log(self, msg: str):
        def write():
            self.log.configure(state="normal")
            self.log.insert("end", time.strftime("[%H:%M:%S]  ") + msg + "\n")
            self.log.see("end")
            self.log.configure(state="disabled")
        self.after(0, write)

    def _set_dot(self, key: str, up: bool):
        dot = self.dots[key]
        dot.delete("all")
        dot.create_oval(1, 1, 11, 11, fill=GREEN if up else GRAY, outline="")
        self.states[key].configure(text="running" if up else "stopped",
                                   fg=GREEN if up else MUTED)

    # ---------- status polling ----------
    def _poll_status(self):
        def check():
            results = {}
            for key, _, host, port in SERVICES:
                if port is not None:
                    results[key] = port_open(host, port, 0.3)
                else:  # celery — tracked by its process handle
                    proc = self.procs.get(key)
                    results[key] = proc is not None and proc.poll() is None
            self.after(0, lambda: [self._set_dot(k, v) for k, v in results.items()])
        threading.Thread(target=check, daemon=True).start()
        self.after(2500, self._poll_status)

    # ---------- process helpers ----------
    def _spawn(self, key: str, cmd, cwd: str):
        logfile = open(os.path.join(LOGS, f"{key}.log"), "a", encoding="utf-8", errors="replace")
        logfile.write(f"\n===== started {time.ctime()} =====\n")
        proc = subprocess.Popen(cmd, cwd=cwd, stdout=logfile, stderr=subprocess.STDOUT,
                                creationflags=CREATE_NO_WINDOW)
        self.procs[key] = proc

    def _kill(self, key: str):
        proc = self.procs.pop(key, None)
        if proc is not None and proc.poll() is None:
            # /T kills the whole tree (npm -> node, etc.)
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           capture_output=True, creationflags=CREATE_NO_WINDOW)

    def _wait_port(self, host: str, port: int, seconds: int) -> bool:
        for _ in range(seconds * 2):
            if port_open(host, port, 0.5):
                return True
            time.sleep(0.5)
        return False

    # ---------- start / stop ----------
    def start_all(self):
        if self.busy:
            return
        self.busy = True
        self.btn_start.configure(state="disabled", text="Starting…")
        threading.Thread(target=self._start_sequence, daemon=True).start()

    def _start_sequence(self):
        try:
            self._log("Booting WSL (PostgreSQL + Redis)…")
            self._spawn("wsl", ["wsl", "-d", "Ubuntu", "--", "sleep", "infinity"], ROOT)
            if not self._wait_port("127.0.0.1", 5432, 60):
                self._log("❌ PostgreSQL didn't come up — check WSL.")
                return
            self._log("✅ PostgreSQL + Redis ready.")

            self._log("Starting backend API (loads embedding model, ~20s)…")
            self._spawn("backend", [VENV_PY, "-m", "uvicorn", "app.main:app",
                                    "--host", "127.0.0.1", "--port", "8000"], BACKEND)
            if not self._wait_port("127.0.0.1", 8000, 90):
                self._log("❌ Backend didn't come up — see logs/backend.log")
                return
            self._log("✅ Backend ready at http://localhost:8000")

            self._log("Starting Celery worker…")
            self._spawn("celery", [VENV_PY, "-m", "celery", "-A", "app.core.celery_app",
                                   "worker", "--loglevel=info", "-P", "solo"], BACKEND)

            self._log("Starting frontend…")
            self._spawn("frontend", ["cmd", "/c", "npm", "run", "dev"], FRONTEND)
            if self._wait_port("127.0.0.1", 3000, 90):
                self._log("✅ Frontend ready — opening browser.")
                webbrowser.open("http://localhost:3000")
            else:
                self._log("❌ Frontend didn't come up — see logs/frontend.log")

            if not port_open("127.0.0.1", 11434, 0.5):
                self._log("⚠️ Ollama isn't running — chat will fall back to excerpts. Start the Ollama app.")
            self._log("All done. First chat answer is slow while the model loads.")
        finally:
            self.busy = False
            self.after(0, lambda: self.btn_start.configure(state="normal", text="▶   Start All"))

    def stop_all(self):
        if self.busy:
            return
        self.busy = True
        self.btn_stop.configure(state="disabled", text="Stopping…")
        threading.Thread(target=self._stop_sequence, daemon=True).start()

    def _stop_sequence(self):
        try:
            self._log("Stopping services…")
            for key in ["frontend", "celery", "backend", "wsl"]:
                self._kill(key)
            subprocess.run(["wsl", "--shutdown"], capture_output=True,
                           creationflags=CREATE_NO_WINDOW)
            self._log("✅ Everything stopped. Data is preserved.")
        finally:
            self.busy = False
            self.after(0, lambda: self.btn_stop.configure(state="normal", text="⏹   Stop All"))

    def _on_close(self):
        running = [k for k, p in self.procs.items() if p.poll() is None]
        if running:
            if messagebox.askyesno("RAG Launcher", "Stop all running services before closing?"):
                self._stop_sequence()
        self.destroy()


if __name__ == "__main__":
    Launcher().mainloop()
