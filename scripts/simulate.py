#!/usr/bin/env python3
"""Dry-run the AI agent in your terminal — NO phone, NO Twilio needed.

You play the student; the agent (Claude) plays the IITM caller. Useful for
tuning iitm_facts.py and the system prompt before spending on real calls.

  python scripts/simulate.py --name "Riya Sharma"

Only needs ANTHROPIC_API_KEY in .env.
"""
import sys
import pathlib
import argparse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from caller import brain  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="Riya Sharma", help="Student name.")
    args = ap.parse_args()

    print(f"\n=== Simulated IITM call with {args.name} ===")
    print("Type what the student says. Blank line or 'bye' to quit.\n")

    history: list[dict] = []
    student_said = None

    while True:
        result = brain.next_line(args.name, history, student_said)
        # mirror what server.py stores
        if student_said is not None:
            history.append({"role": "user",
                             "content": f'The student said: "{student_said}"'})
        history.append({"role": "assistant", "content": result["say"]})

        print(f"AGENT   : {result['say']}")
        print(f"          [sentiment: {result['sentiment']} | "
              f"note: {result['note']}]")

        if result.get("end_call"):
            print("\n=== call ended by agent ===")
            break

        student_said = input("STUDENT : ").strip()
        if not student_said or student_said.lower() in ("bye", "quit", "exit"):
            print("\n=== you ended the simulation ===")
            break


if __name__ == "__main__":
    main()
