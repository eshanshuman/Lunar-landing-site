# Shared project memory

One folder that every assistant on this project reads and updates:

- **Claude Code** (working in this repo) reads it at the start of every session, because `CLAUDE.md` points here.
- **Claude in the claude.ai Project "Lunar Landing Site Navigator"** pulls this branch and reads it, and mirrors these files into the Project's docs.
- **The team** (Osho, Garima, Avin) can read and edit it like any other file.

The repo is the single source of truth. If the Project docs and these files disagree, these files win.

## Files

| File | What it holds | How to update |
|---|---|---|
| `vision.md` | What we are building and why, the pitch story | Rewrite when the vision changes |
| `scope.md` | Every feature, its priority and its honesty rules | Edit in place; this overrides `PLAN.md` §3 for scope |
| `status.md` | What is built, what the data pipeline has produced, what is next | Rewrite the "Now" section at the end of each work session |
| `decisions.md` | Dated log of decisions and why | **Append only**, newest at the bottom |
| `facts.md` | Verified facts and numbers with their sources | Add a source for every line; mark anything unverified |

## Rules for every assistant

1. Read all five files before starting work.
2. After finishing a milestone or a work session: update `status.md`, append to `decisions.md`, commit with the code.
3. Never put a number in the app, deck or pitch that is not in `facts.md` or produced by the pipeline.
4. Dates as YYYY-MM-DD, times in UTC unless marked IST.
