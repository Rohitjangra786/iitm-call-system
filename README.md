# IITM Automated Call System

An outbound voice-calling system for IITM BCA / CET admissions follow-up.
A CLI launches calling campaigns from a contacts list; each call is handled by
an AI agent (Claude) that talks to the student over the phone, answers questions
using verified IITM facts, gauges interest, and logs the outcome.

```
        cli.py                 caller/server.py            Telephony (Twilio)
   ┌──────────────┐          ┌──────────────────┐        ┌──────────────────┐
   │  campaign /  │  REST    │  /voice  webhook │  TwiML │  places the call │
   │  call / etc. │ ───────▶ │  /respond webhook│ ◀────▶ │  speech↔text     │
   └──────────────┘          │  /status webhook │        └──────────────────┘
          │                  └─────────┬────────┘
          │                            │ conversation
          ▼                            ▼
   ┌──────────────┐          ┌──────────────────┐
   │  calls.db    │ ◀──────▶ │  caller/brain.py │  ──▶  Claude API
   │  (SQLite)    │          │  (the AI agent)  │
   └──────────────┘          └──────────────────┘
```

## How a call works (turn-based)

1. `cli.py` reads `data/contacts.csv` and tells Twilio to dial a number.
2. Twilio connects the call and requests TwiML from `POST /voice`.
3. The server asks Claude for an opening line and returns it as `<Say>` +
   `<Gather input="speech">` (Twilio does the speech-to-text).
4. The student speaks. Twilio transcribes it and POSTs to `/respond`.
5. The server feeds the transcript + history to Claude, gets the next line,
   speaks it, and gathers again. This loops until Claude decides to end.
6. The outcome (Interested / Not Interested / Others + transcript) is saved to
   `calls.db`. `cli.py results` prints a summary.

This turn-based design is the **realistic working base** — no websockets, no
media streaming. It is barge-in-free (the bot finishes a sentence before
listening). See *Upgrade path* below for fully-streaming natural conversation.

## Setup

### 1. Install
```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — from console.twilio.com
- `TWILIO_FROM_NUMBER` — a voice-enabled Twilio number you own
- `PUBLIC_URL` — the public URL of your webhook server (see step 3)

### 3. Run the webhook server
The server must be reachable by Twilio over the public internet.
For local development, expose it with a tunnel:
```bash
# terminal 1 — start the server
python cli.py serve

# terminal 2 — expose it (install ngrok first: https://ngrok.com)
ngrok http 8000
```
Copy the `https://....ngrok-free.app` URL ngrok prints into `PUBLIC_URL` in
`.env`, then restart `python cli.py serve`.

### 4. Make calls
```bash
# one test call to yourself first
python cli.py call --to +9198XXXXXXXX --name "Test Student"

# run a campaign over the CSV (rows 241-300 of your sheet)
python cli.py campaign --csv data/contacts.csv --limit 5 --delay 45

# see results
python cli.py results
python cli.py results --csv out/results.csv     # export
```

## CLI reference

| Command | What it does |
|---|---|
| `cli.py serve` | Starts the FastAPI webhook server on `:8000` |
| `cli.py call --to <num> --name <name>` | Places a single call |
| `cli.py campaign --csv <file>` | Calls every contact in the CSV (use `--limit`, `--delay`, `--skip-done`) |
| `cli.py results` | Prints outcomes grouped by sentiment |
| `cli.py contacts` | Lists the loaded contacts |
| `cli.py transcript <call_sid>` | Prints the full transcript of one call |

## Project layout
```
iitm-call-system/
├── cli.py                 # command-line entry point
├── config.py              # loads .env settings
├── iitm_facts.py          # the IITM knowledge base + system prompt
├── requirements.txt
├── .env.example
├── data/
│   └── contacts.csv       # the call sheet (S.No. 241-300)
└── caller/
    ├── db.py              # SQLite: calls + turns + results
    ├── brain.py           # the AI agent (Claude conversation)
    ├── server.py          # FastAPI webhook server (TwiML)
    └── dialer.py          # Twilio outbound call trigger
```

## Compliance — READ THIS BEFORE CALLING REAL NUMBERS

Automated / AI voice calls to consumers are **regulated**. In India, outbound
telemarketing is governed by TRAI: a caller usually must register as a
telemarketer, use approved caller-line series, honour DND (Do Not Disturb)
registries, and call only within permitted hours. Calling students who
*applied to IITM* is generally "transactional/relationship" contact, which is
treated more leniently than cold marketing — but you are responsible for
confirming this with your institution's legal/admin team and your telephony
provider before running a live campaign. Always:
- only call applicants who shared their number with IITM,
- identify the institute and a human at the start of every call,
- let the person opt out and stop calling them,
- keep calls within daytime hours.

This repository is a technical base, not legal advice.

## Upgrade path (later)

- **Streaming voice** — replace the turn-based `<Gather>` loop with Twilio
  Media Streams (websocket). Pipe audio to a streaming STT and a low-latency
  TTS so the bot can be interrupted and feels natural. Bigger build.
- **Better TTS** — swap Twilio `<Say>` for ElevenLabs / Google / Azure neural
  voices for a warmer Indian-English voice.
- **Indian telephony** — Exotel or Plivo are India-first alternatives to
  Twilio with local compliance tooling.
- **Live dashboard** — the HTML call sheet built earlier can be pointed at
  `calls.db` to watch outcomes update in real time.
