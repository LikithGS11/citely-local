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
import os
import socket
import subprocess
import threading
import time
import tkinter as tk
from tkinter import messagebox, scrolledtext
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
VENV_PY = os.path.join(BACKEND, "venv", "Scripts", "python.exe")
LOGS = os.path.join(ROOT, "logs")
CREATE_NO_WINDOW = 0x08000000

SERVICES = [
    # key, label, host, port
    ("postgres", "PostgreSQL (WSL)", "127.0.0.1", 5432),
    ("redis", "Redis (WSL)", "127.0.0.1", 6379),
    ("backend", "Backend API :8000", "127.0.0.1", 8000),
    ("celery", "Celery worker", None, None),  # no port — tracked by process
    ("frontend", "Frontend :3000", "127.0.0.1", 3000),
    ("ollama", "Ollama LLM :11434", "127.0.0.1", 11434),
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
        self.title("Enterprise RAG Launcher")
        self.configure(bg="#0f1117")
        self.resizable(False, False)
        self.procs: dict[str, subprocess.Popen] = {}
        self.busy = False
        os.makedirs(LOGS, exist_ok=True)
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self._poll_status()

    # ---------- UI ----------
    def _build_ui(self):
        pad = {"padx": 14, "pady": 4}
        tk.Label(self, text="Enterprise RAG Platform", bg="#0f1117", fg="#e8e8ff",
                 font=("Segoe UI", 15, "bold")).pack(pady=(14, 0))
        tk.Label(self, text="Ollama + pgvector Hybrid RAG stack", bg="#0f1117", fg="#8890a8",
                 font=("Segoe UI", 9)).pack(pady=(0, 8))

        grid = tk.Frame(self, bg="#0f1117")
        grid.pack(fill="x", **pad)
        self.dots: dict[str, tk.Canvas] = {}
        for i, (key, label, _, _) in enumerate(SERVICES):
            dot = tk.Canvas(grid, width=14, height=14, bg="#0f1117", highlightthickness=0)
            dot.create_oval(2, 2, 12, 12, fill="#555b6e", outline="")
            dot.grid(row=i, column=0, sticky="w", pady=2)
            tk.Label(grid, text=label, bg="#0f1117", fg="#c8cde0", font=("Segoe UI", 10),
                     anchor="w").grid(row=i, column=1, sticky="w", padx=(8, 0))
            self.dots[key] = dot

        btns = tk.Frame(self, bg="#0f1117")
        btns.pack(fill="x", padx=14, pady=10)
        style = dict(font=("Segoe UI", 10, "bold"), relief="flat", cursor="hand2",
                     activeforeground="white", width=12, pady=6)
        self.btn_start = tk.Button(btns, text="▶  Start All", bg="#2563eb", fg="white",
                                   activebackground="#1d4ed8", command=self.start_all, **style)
        self.btn_start.grid(row=0, column=0, padx=(0, 8))
        self.btn_stop = tk.Button(btns, text="⏹  Stop All", bg="#3b4054", fg="#c8cde0",
                                  activebackground="#4b5063", command=self.stop_all, **style)
        self.btn_stop.grid(row=0, column=1, padx=(0, 8))
        self.btn_open = tk.Button(btns, text="🌐  Open App", bg="#3b4054", fg="#c8cde0",
                                  activebackground="#4b5063",
                                  command=lambda: webbrowser.open("http://localhost:3000"), **style)
        self.btn_open.grid(row=0, column=2)

        self.log = scrolledtext.ScrolledText(self, height=9, width=58, bg="#161a24", fg="#9aa3bd",
                                             font=("Consolas", 9), relief="flat", state="disabled")
        self.log.pack(padx=14, pady=(0, 6))

        bottom = tk.Frame(self, bg="#0f1117")
        bottom.pack(fill="x", padx=14, pady=(0, 12))
        tk.Button(bottom, text="Open logs folder", bg="#0f1117", fg="#6b7390", relief="flat",
                  cursor="hand2", font=("Segoe UI", 9, "underline"),
                  command=lambda: os.startfile(LOGS)).pack(side="left")
        tk.Button(bottom, text="API docs", bg="#0f1117", fg="#6b7390", relief="flat",
                  cursor="hand2", font=("Segoe UI", 9, "underline"),
                  command=lambda: webbrowser.open("http://localhost:8000/docs")).pack(side="right")

    def _log(self, msg: str):
        def write():
            self.log.configure(state="normal")
            self.log.insert("end", time.strftime("[%H:%M:%S] ") + msg + "\n")
            self.log.see("end")
            self.log.configure(state="disabled")
        self.after(0, write)

    def _set_dot(self, key: str, up: bool):
        color = "#22c55e" if up else "#555b6e"
        dot = self.dots[key]
        dot.delete("all")
        dot.create_oval(2, 2, 12, 12, fill=color, outline="")

    # ---------- status polling ----------
    def _poll_status(self):
        for key, _, host, port in SERVICES:
            if port is not None:
                up = port_open(host, port, 0.3)
            else:  # celery — tracked by its process handle
                proc = self.procs.get(key)
                up = proc is not None and proc.poll() is None
            self._set_dot(key, up)
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
            self.after(0, lambda: self.btn_start.configure(state="normal", text="▶  Start All"))

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
            self.after(0, lambda: self.btn_stop.configure(state="normal", text="⏹  Stop All"))

    def _on_close(self):
        running = [k for k, p in self.procs.items() if p.poll() is None]
        if running:
            if messagebox.askyesno("RAG Launcher", "Stop all running services before closing?"):
                self._stop_sequence()
        self.destroy()


if __name__ == "__main__":
    Launcher().mainloop()
