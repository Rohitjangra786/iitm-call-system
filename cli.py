#!/usr/bin/env python3
"""IITM Automated Call System — command-line interface.

  python cli.py serve
  python cli.py call --to +9198XXXXXXXX --name "Test Student"
  python cli.py campaign --csv data/contacts.csv --limit 5 --delay 45
  python cli.py results
  python cli.py contacts
  python cli.py transcript <call_sid>
"""
import csv
import sys
import time

import click

import config
from caller import db


# ----------------------------- helpers ------------------------------------

def _load_contacts(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _norm_phone(raw: str) -> str:
    """Normalise an Indian number to E.164 (+91XXXXXXXXXX)."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    if raw.startswith("+"):
        return raw
    return "+" + digits


# ------------------------------ commands -----------------------------------

@click.group()
def cli():
    """Outbound AI calling for IITM BCA / CET admissions."""
    db.init_db()


@cli.command()
def serve():
    """Start the FastAPI webhook server (Twilio talks to this)."""
    import uvicorn
    click.echo(f"Webhook server on http://{config.SERVER_HOST}:{config.SERVER_PORT}")
    click.echo(f"Public URL (Twilio side): {config.PUBLIC_URL}")
    if "ngrok" not in config.PUBLIC_URL and "localhost" in config.PUBLIC_URL:
        click.secho("  ! PUBLIC_URL looks local — Twilio needs a public URL "
                     "(use ngrok).", fg="yellow")
    uvicorn.run("caller.server:app", host=config.SERVER_HOST,
                port=config.SERVER_PORT, reload=False)


@cli.command()
@click.option("--to", "to_number", required=True, help="Phone number to call.")
@click.option("--name", default="there", help="Student's name.")
@click.option("--id", "contact_id", default="", help="Optional contact id.")
def call(to_number, name, contact_id):
    """Place a single call."""
    from caller import dialer
    num = _norm_phone(to_number)
    click.echo(f"Calling {name} at {num} ...")
    try:
        sid = dialer.place_call(num, name, contact_id)
        click.secho(f"  call started — CallSid {sid}", fg="green")
    except Exception as e:
        click.secho(f"  failed: {e}", fg="red")
        sys.exit(1)


@cli.command()
@click.option("--csv", "csv_path", default="data/contacts.csv",
              help="Contacts CSV file.")
@click.option("--limit", default=0, help="Max calls (0 = all).")
@click.option("--delay", default=45, help="Seconds to wait between calls.")
@click.option("--skip-done", is_flag=True,
              help="Skip contacts already completed.")
def campaign(csv_path, limit, delay, skip_done):
    """Call every contact in a CSV, one after another."""
    from caller import dialer
    rows = _load_contacts(csv_path)
    if limit:
        rows = rows[:limit] if not skip_done else rows
    click.echo(f"Campaign: {len(rows)} contacts from {csv_path}")
    click.secho("Reminder: only call applicants who consented, within "
                "daytime hours. See README > Compliance.\n", fg="yellow")

    done = 0
    for row in rows:
        cid = row.get("S.No.", "").strip()
        name = row.get("Name", "there").strip()
        phone = _norm_phone(row.get("Telephone No.", ""))

        if skip_done and cid and db.already_called(cid):
            click.echo(f"  skip  #{cid} {name} (already done)")
            continue
        if limit and done >= limit:
            break

        click.echo(f"  call  #{cid} {name} -> {phone}")
        try:
            sid = dialer.place_call(phone, name, cid)
            click.secho(f"        started ({sid})", fg="green")
            done += 1
        except Exception as e:
            click.secho(f"        failed: {e}", fg="red")

        if done < (limit or len(rows)):
            time.sleep(delay)

    click.echo(f"\nDone. {done} call(s) placed. Run 'cli.py results' shortly.")


@cli.command()
@click.option("--csv", "out_csv", default="", help="Also export results to CSV.")
def results(out_csv):
    """Show outcomes grouped by sentiment."""
    rows = db.all_results()
    if not rows:
        click.echo("No calls yet.")
        return

    buckets: dict[str, list] = {}
    for r in rows:
        buckets.setdefault(r["remark"] or "Pending", []).append(r)

    for bucket, items in sorted(buckets.items()):
        click.secho(f"\n{bucket}  ({len(items)})", fg="cyan", bold=True)
        for r in items:
            click.echo(f"  #{r['contact_id'] or '-':>4}  {r['name']:<22} "
                       f"{r['phone']:<16} {r['status']}")

    click.secho(f"\nTotal calls: {len(rows)}", bold=True)

    if out_csv:
        with open(out_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["contact_id", "name", "phone", "status",
                        "sentiment", "remark", "started_at", "ended_at"])
            for r in rows:
                w.writerow([r["contact_id"], r["name"], r["phone"], r["status"],
                            r["sentiment"], r["remark"], r["started_at"],
                            r["ended_at"]])
        click.secho(f"Exported -> {out_csv}", fg="green")


@cli.command()
@click.option("--csv", "csv_path", default="data/contacts.csv")
def contacts(csv_path):
    """List the contacts in the CSV."""
    rows = _load_contacts(csv_path)
    for r in rows:
        click.echo(f"  #{r.get('S.No.','-'):>4}  {r.get('Name',''):<24} "
                   f"{_norm_phone(r.get('Telephone No.',''))}")
    click.echo(f"\n{len(rows)} contacts.")


@cli.command()
@click.argument("call_sid")
def transcript(call_sid):
    """Print the full transcript of one call."""
    turns = db.transcript(call_sid)
    if not turns:
        click.echo("No transcript for that CallSid.")
        return
    call = db.get_call(call_sid)
    if call:
        click.secho(f"{call['name']}  ({call['phone']})  -> {call['remark']}",
                    fg="cyan", bold=True)
    for t in turns:
        who = "AGENT  " if t["role"] == "agent" else "STUDENT"
        colour = "green" if t["role"] == "agent" else "white"
        click.secho(f"  {who}: {t['text']}", fg=colour)


if __name__ == "__main__":
    cli()
