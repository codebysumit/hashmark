(() => {
      "use strict";

      const algorithms = [
        { name: "MD5", length: 32, weak: true, digest: bytes => md5(bytes) },
        { name: "SHA-1", length: 40, weak: true, crypto: "SHA-1" },
        { name: "SHA-224", length: 56, digest: bytes => sha224(bytes) },
        { name: "SHA-256", length: 64, crypto: "SHA-256" },
        { name: "SHA3-256", length: 64, digest: bytes => sha3_256(bytes) },
        { name: "SHA-384", length: 96, crypto: "SHA-384" },
        { name: "SHA-512", length: 128, crypto: "SHA-512" },
        { name: "SHA3-512", length: 128, digest: bytes => sha3_512(bytes) },
        { name: "CRC32", length: 8, digest: bytes => (CRC32.buf(bytes) >>> 0).toString(16).padStart(8, "0") }
      ];
      const byId = id => document.getElementById(id);
      const inputState = {
        generate: { mode: "file", file: null },
        match: { mode: "file", file: null }
      };

      function getSelectedAlgorithms() {
        const selected = byId("algorithmSelect").value;
        return selected === "all" ? algorithms : algorithms.filter(algorithm => algorithm.name === selected);
      }

      function updateGenerateSelection() {
        const selected = getSelectedAlgorithms();
        const isAll = byId("algorithmSelect").value === "all";
        byId("generateButtonLabel").textContent = isAll
          ? "Generate all hashes"
          : `Generate ${selected[0].name}`;
        byId("resultCount").textContent = `${selected.length} ${selected.length === 1 ? "algorithm" : "algorithms"}`;
        byId("generateResults").hidden = true;
      }

      byId("algorithmSelect").addEventListener("change", updateGenerateSelection);
      updateGenerateSelection();

      function formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        const units = ["KB", "MB", "GB", "TB"];
        let size = bytes / 1024;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
          size /= 1024;
          unit++;
        }
        return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
      }

      function setError(prefix, message) {
        byId(`${prefix}Error`).textContent = message;
      }

      function setProgress(prefix, percent, label) {
        byId(`${prefix}Progress`).hidden = false;
        byId(`${prefix}ProgressBar`).value = percent;
        byId(`${prefix}ProgressValue`).textContent = `${Math.round(percent)}%`;
        byId(`${prefix}ProgressLabel`).textContent = label;
      }

      function hideProgress(prefix) {
        byId(`${prefix}Progress`).hidden = true;
      }

      function updateFileMeta(prefix, file) {
        byId(`${prefix}Meta`).innerHTML = file
          ? `<strong>${escapeHtml(file.name)}</strong> · ${formatSize(file.size)}`
          : "";
      }

      function escapeHtml(value) {
        return value.replace(/[&<>"']/g, char => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[char]);
      }

      function setInputMode(prefix, mode) {
        const panel = byId(`${prefix}Panel`);
        inputState[prefix].mode = mode;
        panel.querySelectorAll(".source-option").forEach(button => {
          button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
        });
        panel.querySelector(".dropzone").hidden = mode !== "file";
        panel.querySelector(".text-input").hidden = mode !== "text";
        if (mode === "file") {
          inputState[prefix].file = null;
          byId(`${prefix}File`).value = "";
          updateFileMeta(prefix, null);
        }
      }

      ["generate", "match"].forEach(prefix => {
        const panel = byId(`${prefix}Panel`);
        panel.querySelectorAll(".source-option").forEach(button => {
          button.addEventListener("click", () => setInputMode(prefix, button.dataset.mode));
        });
        byId(`${prefix}File`).addEventListener("change", event => {
          const file = event.target.files[0] || null;
          inputState[prefix].file = file;
          updateFileMeta(prefix, file);
          setError(prefix, "");
        });
        const dropzone = byId(`${prefix}Dropzone`);
        ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
          event.preventDefault();
          dropzone.classList.add("dragover");
        }));
        ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
          event.preventDefault();
          dropzone.classList.remove("dragover");
        }));
        dropzone.addEventListener("drop", event => {
          const file = event.dataTransfer.files[0] || null;
          if (!file) return;
          inputState[prefix].file = file;
          const transfer = new DataTransfer();
          transfer.items.add(file);
          byId(`${prefix}File`).files = transfer.files;
          updateFileMeta(prefix, file);
          setError(prefix, "");
        });
      });

      document.querySelectorAll('[role="tab"]').forEach(tab => {
        tab.addEventListener("click", () => activateTab(tab));
        tab.addEventListener("keydown", event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const other = tab.id === "generateTab" ? byId("matchTab") : byId("generateTab");
          activateTab(other);
          other.focus();
        });
      });

      function activateTab(tab) {
        const isGenerate = tab.id === "generateTab";
        byId("generateTab").setAttribute("aria-selected", String(isGenerate));
        byId("generateTab").tabIndex = isGenerate ? 0 : -1;
        byId("matchTab").setAttribute("aria-selected", String(!isGenerate));
        byId("matchTab").tabIndex = isGenerate ? -1 : 0;
        byId("generatePanel").hidden = !isGenerate;
        byId("matchPanel").hidden = isGenerate;
      }

      async function getInputBytes(prefix) {
        const state = inputState[prefix];
        if (state.mode === "text") {
          hideProgress(prefix);
          return new TextEncoder().encode(byId(`${prefix}Text`).value);
        }

        const file = state.file;
        if (!file) throw new Error("Choose a file or switch to text input.");
        if (file.size > 1024 * 1024) setProgress(prefix, 0, "Reading file…");
        const bytes = new Uint8Array(file.size);
        const chunkSize = 2 * 1024 * 1024;
        for (let offset = 0; offset < file.size; offset += chunkSize) {
          const chunk = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
          bytes.set(new Uint8Array(chunk), offset);
          if (file.size > 1024 * 1024) {
            setProgress(prefix, (offset + chunk.byteLength) / file.size * 40, "Reading file…");
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        return bytes;
      }

      async function hashWith(algorithm, bytes) {
        if (algorithm.crypto) {
          if (!globalThis.crypto || !crypto.subtle) throw new Error("Web Crypto is unavailable. Open this page in a secure browser context (HTTPS or localhost).");
          const digest = await crypto.subtle.digest(algorithm.crypto, bytes);
          return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        }
        return algorithm.digest(bytes);
      }

      async function computeHashes(bytes, prefix, selected = algorithms) {
        const results = [];
        const showProgress = inputState[prefix].mode === "file" && inputState[prefix].file.size > 1024 * 1024;
        for (let index = 0; index < selected.length; index++) {
          const percent = (index + 1) / selected.length * 100;
          const base = showProgress ? 40 : 0;
          if (showProgress) setProgress(prefix, base + percent * (100 - base) / 100, `Calculating ${selected[index].name}…`);
          await new Promise(resolve => setTimeout(resolve, 0));
          results.push([selected[index], await hashWith(selected[index], bytes)]);
        }
        return results;
      }

      function renderHashes(results) {
        const list = byId("hashList");
        list.replaceChildren();
        results.forEach(([algorithm, value]) => {
          const row = document.createElement("div");
          row.className = "hash-row";
          const name = document.createElement("div");
          name.className = "algorithm";
          name.textContent = algorithm.name;
          if (algorithm.weak) {
            const warning = document.createElement("span");
            warning.className = "weak-warning";
            warning.textContent = "WEAK";
            warning.title = "Not recommended for security-sensitive uses";
            name.append(" ", warning);
          }
          const hash = document.createElement("div");
          hash.className = "hash-value";
          hash.textContent = value;
          hash.title = value;
          const copy = document.createElement("button");
          copy.className = "icon-button copy-button";
          copy.type = "button";
          copy.setAttribute("aria-label", `Copy ${algorithm.name} hash`);
          copy.title = `Copy ${algorithm.name}`;
          copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
          copy.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(value);
              copy.title = "Copied!";
              copy.setAttribute("aria-label", `${algorithm.name} hash copied`);
              setTimeout(() => {
                copy.title = `Copy ${algorithm.name}`;
                copy.setAttribute("aria-label", `Copy ${algorithm.name} hash`);
              }, 1400);
            } catch (error) {
              setError("generate", `Could not copy to clipboard: ${error.message}`);
            }
          });
          row.append(name, hash, copy);
          list.append(row);
        });
      }

      function setBusy(prefix, busy) {
        byId(`${prefix}Button`).disabled = busy;
        byId(`${prefix}Button`).setAttribute("aria-busy", String(busy));
      }

      byId("generateButton").addEventListener("click", async () => {
        setError("generate", "");
        byId("generateResults").hidden = true;
        setBusy("generate", true);
        try {
          const bytes = await getInputBytes("generate");
          const selectedAlgorithms = getSelectedAlgorithms();
          const results = await computeHashes(bytes, "generate", selectedAlgorithms);
          renderHashes(results);
          byId("generateResults").hidden = false;
          if (inputState.generate.mode === "file" && inputState.generate.file.size > 1024 * 1024) {
            setProgress("generate", 100, `${selectedAlgorithms.length} hash${selectedAlgorithms.length === 1 ? "" : "es"} calculated`);
          } else {
            hideProgress("generate");
          }
        } catch (error) {
          setError("generate", error.message);
          hideProgress("generate");
        } finally {
          setBusy("generate", false);
        }
      });

      function showMatchResult(type, title, detail) {
        const result = byId("matchResult");
        result.className = `match-result ${type}`;
        byId("matchIcon").textContent = type === "is-match" ? "✓" : type === "is-miss" ? "×" : "!";
        byId("matchTitle").textContent = title;
        byId("matchDetail").textContent = detail;
        result.hidden = false;
      }

      function showMatchError(message) {
        byId("matchResult").hidden = true;
        setError("match", message);
      }

      byId("matchButton").addEventListener("click", async () => {
        setError("match", "");
        byId("matchResult").hidden = true;
        setBusy("match", true);
        try {
          const known = byId("knownHash").value.trim();
          if (!known) throw new Error("Paste a known hash to verify.");
          if (!/^[0-9a-f]+$/i.test(known)) throw new Error("The known hash must contain hexadecimal characters only.");
          const candidates = algorithms.filter(algorithm => algorithm.length === known.length);
          if (!candidates.length) throw new Error(`No supported hash type has ${known.length} hexadecimal characters.`);
          const bytes = await getInputBytes("match");
          const results = await computeHashes(bytes, "match", candidates);
          const matched = results.filter(([, value]) => value.toLowerCase() === known.toLowerCase()).map(([algorithm]) => algorithm.name);
          if (matched.length) {
            showMatchResult("is-match", "Match", `The hash matches ${matched.join(" and ")}${candidates.length > 1 ? ` (${candidates.length} possible algorithms checked)` : ""}.`);
          } else {
            const checked = candidates.map(algorithm => algorithm.name).join(", ");
            showMatchResult("is-miss", "No Match", `The hash did not match ${checked}.`);
          }
          if (inputState.match.mode === "file" && inputState.match.file.size > 1024 * 1024) {
            setProgress("match", 100, "Verification complete");
          } else {
            hideProgress("match");
          }
        } catch (error) {
          showMatchError(error.message);
          hideProgress("match");
        } finally {
          setBusy("match", false);
        }
      });

      byId("themeToggle").addEventListener("click", () => {
        const dark = document.documentElement.dataset.theme !== "dark";
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        const label = `Switch to ${dark ? "light" : "dark"} mode`;
        byId("themeToggle").setAttribute("aria-label", label);
        byId("themeToggle").title = label;
        byId("themeIcon").innerHTML = dark
          ? '<path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
        try { localStorage.setItem("hashmark-theme", dark ? "dark" : "light"); }
        catch (error) { console.warn("Theme preference could not be saved.", error); }
      });

      try {
        const savedTheme = localStorage.getItem("hashmark-theme");
        if (savedTheme === "dark") byId("themeToggle").click();
      } catch (error) {
        console.warn("Saved theme preference could not be read.", error);
      }
    })();
