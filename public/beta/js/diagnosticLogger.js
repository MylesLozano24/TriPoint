/**
 * Hunter Radar — Diagnostic Logger
 * Timestamped, exportable log for the beta console.
 */

const HunterRadarLogger = (() => {

  function createLogger(containerEl, { maxLines = 500 } = {}) {
    const entries = [];

    function timestamp() {
      const d = new Date();
      const pad = (n, len = 2) => String(n).padStart(len, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    }

    function log(message, level = "info") {
      const time = timestamp();
      entries.push({ time, message, level });
      if (entries.length > maxLines) entries.shift();

      if (containerEl) {
        const line = document.createElement("div");
        line.className = `log-line log-line--${level}`;
        const timeEl = document.createElement("time");
        timeEl.textContent = `[${time}]`;
        line.appendChild(timeEl);
        line.appendChild(document.createTextNode(message));
        containerEl.appendChild(line);

        while (containerEl.children.length > maxLines) {
          containerEl.removeChild(containerEl.firstChild);
        }
        containerEl.scrollTop = containerEl.scrollHeight;
      }
    }

    function clear() {
      entries.length = 0;
      if (containerEl) containerEl.innerHTML = "";
    }

    function exportLog() {
      const lines = entries.map((e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`);
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `hunter-radar-session-${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function exportJSON() {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `hunter-radar-session-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    return { log, clear, exportLog, exportJSON, entries };
  }

  return { createLogger };
})();
