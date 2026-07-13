"""
F1 Full Schedule Catalog Generator
=====================================
Run:  python generate_catalog.py

Fetches the full F1 event schedule for seasons 2018-2026 via FastF1,
then writes public/data/catalog.json.

Each entry in catalog.json:
  {
    "year":         2024,
    "event":        "Monaco Grand Prix",
    "eventSlug":    "monaco",        <- lowercase, no spaces, used for sessionId
    "session_type": "R",
    "label":        "Race",
    "country":      "Monaco",
    "countryCode":  "mc",
    "date":         "2024-05-26",
    "cached":       true             <- true if public/data/<sessionId> already exists
  }

Session types exported per event: Q (Qualifying), R (Race).
Sprint weekends also export SQ (Sprint Qualifying) and S (Sprint).
"""

import json
import os
import sys

import fastf1
import pandas as pd

# ------------------------------------------------------------------
# Country-code helper (same table as ingest.py)
COUNTRY_CODES = {
    "monaco": "mc", "united kingdom": "gb", "italy": "it", "spain": "es",
    "belgium": "be", "netherlands": "nl", "austria": "at", "hungary": "hu",
    "singapore": "sg", "japan": "jp", "qatar": "qa", "uae": "ae",
    "united arab emirates": "ae", "saudi arabia": "sa", "bahrain": "bh",
    "australia": "au", "canada": "ca", "mexico": "mx", "brazil": "br",
    "usa": "us", "united states": "us", "china": "cn", "azerbaijan": "az",
    "abu dhabi": "ae", "miami": "us", "las vegas": "us", "imola": "it",
    "monza": "it", "zandvoort": "nl", "spa": "be", "silverstone": "gb",
}

SESSION_TYPE_LABELS = {
    "R": "Race",
    "Q": "Qualifying",
    "S": "Sprint",
    "SQ": "Sprint Qualifying",
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
}

# Session types to include (keep it concise — Race + Qualifying only by default)
INCLUDE_SESSION_TYPES = ["R", "Q"]


def get_country_code(country_name: str) -> str:
    if not country_name:
        return "un"
    c = country_name.lower().strip()
    return COUNTRY_CODES.get(c, "un")


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-").replace("'", "").replace(".", "")


def build_catalog(years: range) -> list:
    catalog = []

    cache_dir = os.path.join(os.getcwd(), ".fastf1_cache")
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)

    data_dir = os.path.join(os.getcwd(), "public", "data")

    for year in years:
        print(f"  Fetching schedule for {year}…", flush=True)
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except Exception as exc:
            print(f"    ⚠ Could not fetch {year} schedule: {exc}")
            continue

        for _, row in schedule.iterrows():
            event_name = row.get("EventName", "")
            country = row.get("Country", "")
            country_code = get_country_code(country)

            # Determine which session types this event supports
            session_types_this_event = list(INCLUDE_SESSION_TYPES)

            # Sprint weekend detection (F1 events have Session3 = "Sprint Qualifying")
            is_sprint = str(row.get("EventFormat", "")).lower() in ("sprint_qualifying", "sprint", "sprint_shootout")
            if is_sprint:
                session_types_this_event = ["SQ", "S", "Q", "R"]

            for stype in session_types_this_event:
                # Build the session date for this type
                session_date_col = {
                    "R": "Session5Date", "Q": "Session4Date",
                    "S": "Session3Date", "SQ": "Session2Date",
                    "FP3": "Session3Date", "FP2": "Session2Date", "FP1": "Session1Date",
                }.get(stype, "EventDate")

                raw_date = row.get(session_date_col, row.get("EventDate"))
                if pd.isna(raw_date):
                    raw_date = row.get("EventDate")

                try:
                    date_str = str(pd.Timestamp(raw_date).date()) if not pd.isna(raw_date) else ""
                except Exception:
                    date_str = ""

                event_slug = slugify(row.get("Location", event_name).strip())
                session_id = f"{year}-{event_slug}-{stype.lower()}"

                # Check cached on disk (Location-based slug first)
                session_dir = os.path.join(data_dir, session_id)
                cached = os.path.exists(os.path.join(session_dir, "meta.json"))

                # Also check EventName-based slug (legacy ingestions like "2024-monza-r")
                if not cached:
                    alt_slug = slugify(event_name.replace(" Grand Prix", "").replace(" GP", "").strip())
                    alt_id = f"{year}-{alt_slug}-{stype.lower()}"
                    alt_dir = os.path.join(data_dir, alt_id)
                    if os.path.exists(os.path.join(alt_dir, "meta.json")):
                        cached = True
                        session_id = alt_id  # use the existing ID so the frontend loads correctly
                        event_slug = alt_slug

                catalog.append({
                    "year": int(year),
                    "event": event_name,
                    "eventSlug": event_slug,
                    "session_type": stype,
                    "label": SESSION_TYPE_LABELS.get(stype, stype),
                    "sessionId": session_id,
                    "country": country,
                    "countryCode": country_code,
                    "date": date_str,
                    "cached": cached,
                })

    # Sort: newest first, then by event date within year
    catalog.sort(key=lambda e: (e["year"], e["date"]), reverse=True)
    return catalog


def main():
    start_year = 2018
    end_year = 2026

    print(f"Generating F1 catalog for {start_year}–{end_year}…")
    catalog = build_catalog(range(start_year, end_year + 1))

    out_path = os.path.join(os.getcwd(), "public", "data", "catalog.json")
    with open(out_path, "w") as f:
        json.dump(catalog, f, indent=2)

    cached_count = sum(1 for e in catalog if e["cached"])
    print(f"\nDone: catalog.json written: {len(catalog)} sessions, {cached_count} cached -> {out_path}")


if __name__ == "__main__":
    main()
