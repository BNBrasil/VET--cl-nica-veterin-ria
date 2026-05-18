---
name: terminal-turbo
description: "Configures Claude to execute terminal tasks with maximum speed, zero unnecessary output, batch-chained commands, and non-interactive bypasses."
risk: low
source: custom
date_added: "2026-05-14"
---

# Terminal Turbo

## Goal
Execute tasks in the terminal with **extreme speed and minimal roundtrips**. Cut down the overhead of conversational text, interactive prompts, and repetitive command invocations.

## Core Philosophy
1. **Combine and Chain**: Never run three commands sequentially if they can be chained into one.
2. **Zero Interactivity**: Use auto-confirm flags (`-y`, `--yes`, `--force`) to bypass CLI questions.
3. **No Verbosity**: Use silent flags (`--silent`, `--quiet`, `> nul` / `> /dev/null`) to keep outputs clean and fast.
4. **Parallel Operations**: When multiple safe, non-blocking steps are needed, start them in parallel or background threads.
5. **No Explanatory Fluff**: Skip "I am going to run X command now...". Just run the command and report the outcome instantly.

---

## Command Execution Guidelines

### 1. Command Chaining (PowerShell / Bash)
Instead of:
```powershell
mkdir my-folder
# wait
cd my-folder
# wait
npm init -y
```
Do this in **one single command**:
```powershell
mkdir my-folder; cd my-folder; npm init -y
```
*(Use `;` or `&&` depending on the shell environment. For Windows PowerShell, `;` or `&&` works in modern versions).*

### 2. Non-Interactive Flag Injection
Always append flags that suppress prompts and speed up processing:
- **npm**: `npm install --silent --no-audit --no-fund`
- **npx**: `npx -y <package>`
- **git**: `git commit -m "message" --quiet`
- **pip**: `pip install --quiet --no-cache-dir`
- **general utilities**: Always check if `-y`, `-f`, or `-q` is supported.

### 3. Optimal Tool Selection
- **Searching Content**: Prefer `grep_search` (ripgrep) over running raw `findstr` or manual `cat | grep` scripts.
- **Viewing Files**: Pass exact `StartLine` and `EndLine` variables to `view_file` to minimize context bloat and retrieval time.
- **Writing Files**: Use `replace_file_content` for specific targeted edits rather than overwriting large files entirely, unless it's a new file.

### 4. Background Tasks and Automation
- When starting servers or testing loops, set `WaitMsBeforeAsync` to short intervals and immediately proceed.
- Explicitly leverage `SafeToAutoRun: true` for read-only commands (e.g. directory listings, status checks, version querying) so the user doesn't need to manually confirm mundane steps.

---

## Response Style
- **No conversational fillers** (e.g., "Certainly!", "Sure, let's run this").
- Go **straight to the tool execution**.
- Use very short, keyword-rich `toolAction` descriptions.
- If a command succeeds, briefly state the output or just move directly to the next required action.

## When to Use
Activate this skill when requested to execute terminal operations efficiently, during mass file manipulation, environment setup, dependency installation, or repetitive script execution routines.
