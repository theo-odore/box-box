import os
import sys
import json
import numpy as np
import pandas as pd
import fastf1

# Mappings for F1 flagcdn flag codes
COUNTRY_CODES = {
    "monaco": "mc",
    "united kingdom": "gb",
    "italy": "it",
    "spain": "es",
    "belgium": "be",
    "netherlands": "nl",
    "austria": "at",
    "hungary": "hu",
    "singapore": "sg",
    "japan": "jp",
    "qatar": "qa",
    "uae": "ae",
    "united arab emirates": "ae",
    "saudi arabia": "sa",
    "bahrain": "bh",
    "australia": "au",
    "canada": "ca",
    "mexico": "mx",
    "brazil": "br",
    "usa": "us",
    "united states": "us",
    "china": "cn",
    "azerbaijan": "az",
}

# Mappings for DRS zones count
DRS_ZONES = {
    "monaco": 1,
    "bahrain": 3,
    "saudi arabia": 3,
    "australia": 4,
    "japan": 1,
    "china": 2,
    "miami": 3,
    "imola": 1,
    "canada": 3,
    "spain": 2,
    "austria": 3,
    "great britain": 2,
    "hungary": 2,
    "belgium": 2,
    "netherlands": 2,
    "monza": 2,
    "azerbaijan": 2,
    "singapore": 4,
    "austin": 2,
    "mexico": 3,
    "brazil": 2,
    "las vegas": 3,
    "qatar": 1,
    "abu dhabi": 2,
}

def map_times_to_laps(times, drv_laps):
    lap_numbers = np.zeros(len(times), dtype=int)
    for _, lap in drv_laps.iterrows():
        lap_num = int(lap["LapNumber"])
        start_sec = lap["LapStartTime"].total_seconds() if not pd.isna(lap["LapStartTime"]) else 0.0
        end_sec = lap["Time"].total_seconds() if not pd.isna(lap["Time"]) else 0.0
        mask = (times >= start_sec) & (times <= end_sec)
        lap_numbers[mask] = lap_num
    return lap_numbers

def get_country_code(country_name):
    if not country_name:
        return "un"
    c_lower = country_name.lower().strip()
    return COUNTRY_CODES.get(c_lower, "un")

def generate_manifest():
    print("Generating index.json manifest...")
    data_dir = os.path.join(os.getcwd(), "public", "data")
    if not os.path.exists(data_dir):
        print("Data directory not found. Skipping manifest generation.")
        return
        
    manifest = []
    
    for entry in os.listdir(data_dir):
        entry_path = os.path.join(data_dir, entry)
        if os.path.isdir(entry_path):
            meta_path = os.path.join(entry_path, "meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r") as f:
                        meta = json.load(f)
                        
                    event_name = meta.get("event", "Unknown GP")
                    
                    # Deduce country/countryCode if missing in older meta
                    country = meta.get("country")
                    country_code = meta.get("countryCode")
                    if not country or not country_code:
                        # Deduce from event name
                        for c_name, c_code in COUNTRY_CODES.items():
                            if c_name in event_name.lower():
                                country = c_name.title()
                                country_code = c_code
                                break
                        if not country:
                            country = "Unknown"
                            country_code = "un"
                            
                        # Save back the enriched properties to the meta.json
                        meta["country"] = country
                        meta["countryCode"] = country_code
                        with open(meta_path, "w") as fw:
                            json.dump(meta, fw, indent=2)
                            
                    manifest.append({
                        "id": meta.get("sessionId"),
                        "year": meta.get("year"),
                        "event": event_name,
                        "country": country,
                        "countryCode": country_code,
                        "session": meta.get("session", "Race"),
                        "date": meta.get("date"),
                        "circuit": meta.get("trackName", "Unknown Circuit"),
                        "totalLaps": meta.get("totalLaps", 78)
                    })
                except Exception as e:
                    print(f"Error reading meta.json in {entry}: {e}")
                    
    # Sort manifest: year descending, then event alphabetical
    manifest.sort(key=lambda x: (x.get("year", 0), x.get("event", "")), reverse=True)
    
    manifest_path = os.path.join(data_dir, "index.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written with {len(manifest)} sessions: {manifest_path}")

def ingest_session(year=2024, event="Monaco", session_type="R"):
    print(f"Initializing FastF1 session: {year} {event} {session_type}...")
    
    # Configure cache
    cache_dir = os.path.join(os.getcwd(), ".fastf1_cache")
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    
    # Load session
    try:
        session = fastf1.get_session(year, event, session_type)
        session.load()
    except Exception as e:
        print(f"Error loading session: {e}")
        sys.exit(1)
        
    session_id = f"{year}-{event.lower()}-{session_type.lower()}"
    output_dir = os.path.join(os.getcwd(), "public", "data", session_id)
    telemetry_dir = os.path.join(output_dir, "telemetry")
    os.makedirs(telemetry_dir, exist_ok=True)
    
    print(f"Saving data to: {output_dir}")
    
    # 1. Fetch and process metadata
    print("Processing metadata...")
    drivers_list = list(session.results["Abbreviation"].unique())
    drivers_meta = {}
    
    for _, row in session.results.iterrows():
        abbr = row["Abbreviation"]
        team_color = getattr(row, "TeamColor", "ffffff")
        if pd.isna(team_color) or not team_color:
            team_color = "ffffff"
        if not team_color.startswith("#"):
            team_color = f"#{team_color}"
            
        drivers_meta[abbr] = {
            "name": row["FullName"],
            "number": str(row["DriverNumber"]),
            "team": row["TeamName"],
            "color": team_color,
            "grid": int(row["GridPosition"]) if not pd.isna(row["GridPosition"]) else 0,
            "position": int(row["Position"]) if not pd.isna(row["Position"]) else None,
            "points": float(row["Points"]) if not pd.isna(row["Points"]) else 0.0,
            "status": row["Status"]
        }
        
    # Get Circuit Outline (from fastest lap in session)
    circuit_outline = {"x": [], "y": []}
    track_length_m = 3337 # Monaco fallback
    grid_slots = {}  # {"VER": [x, y], ...}
    fastest_telemetry = None
    
    try:
        fastest_lap = session.laps.pick_fastest()
        fastest_telemetry = fastest_lap.get_telemetry()
        # Downsample outline to ~400 points
        step = max(1, len(fastest_telemetry) // 400)
        x_outline = fastest_telemetry["X"].values[::step]
        y_outline = fastest_telemetry["Y"].values[::step]
        # Clean coordinates
        x_outline = x_outline[~np.isnan(x_outline)]
        y_outline = y_outline[~np.isnan(y_outline)]
        
        circuit_outline = {
            "x": [round(float(x), 1) for x in x_outline],
            "y": [round(float(y), 1) for y in y_outline]
        }
        
        # Pull length from fastest lap total distance
        track_length_m = int(fastest_telemetry["Distance"].max())
    except Exception as e:
        print(f"Warning: Could not extract circuit outline or length: {e}")

    # ── Compute grid-slot coordinates from actual pos_data ───────────────────
    # Strategy: sample each car's broadcast position from session.pos_data at
    # the time they are stationary on the starting grid (just before lights-out).
    # This uses the *same* coordinate frame as all chunk telemetry, so dots snap
    # to exactly where the static cars appear on the canvas — no frame mismatch.
    #
    # We pick a sample 8 seconds before the earliest lap-1 start, when cars are
    # stationary. We also fall back to a window search (10–60s before race start)
    # if pos_data doesn't have a clean sample at exactly that time.
    #
    # race_start_elapsed is also stored in meta so the frontend knows when to stop
    # using grid-snap and switch to interpolated telemetry.

    race_start_elapsed = None   # will be set below once we know lap-1 times
    # (We'll compute grid slots after laps are processed — see after laps section)
        
    # Get Corner Information
    corners_list = []
    try:
        circuit_info = session.get_circuit_info()
        if circuit_info is not None and circuit_info.corners is not None:
            for _, corner in circuit_info.corners.iterrows():
                corners_list.append({
                    "number": int(corner["Number"]),
                    "x": round(float(corner["X"]), 1),
                    "y": round(float(corner["Y"]), 1),
                    "angle": int(corner["Angle"]) if "Angle" in corner else 0,
                    "distance": round(float(corner["Distance"]), 1) if "Distance" in corner else 0.0
                })
    except Exception as e:
        print(f"Warning: Could not load corner info: {e}")
        
    # Session stats
    try:
        total_laps = int(session.laps["LapNumber"].max())
    except:
        total_laps = 78 # fallback
        
    event_country = session.event.get("Country", event)
    event_code = get_country_code(event_country)
    
    meta = {
        "sessionId": session_id,
        "year": int(year),
        "event": session.event.get("EventName", f"{event} Grand Prix"),
        "country": event_country,
        "countryCode": event_code,
        "session": "Race",
        "date": str(session.date.date()) if hasattr(session, "date") else "2024-05-26",
        "totalLaps": total_laps,
        "trackName": session.event.get("OfficialEventName", f"Circuit of {event_country}"),
        "drivers": drivers_meta,
        "circuit": {
            "outline": circuit_outline,
            "corners": corners_list,
            "length": track_length_m,
            "drsZones": DRS_ZONES.get(event.lower(), 2),
            "cornersCount": len(corners_list) if corners_list else 15,
            "speedTrapSpeed": 315.0 if event.lower() != "monaco" else 307.8
        },
        "gridSlots": grid_slots
    }
    
    with open(os.path.join(output_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
        
    # 2. Process Weather Data
    print("Processing weather data...")
    weather_list = []
    if session.weather_data is not None and len(session.weather_data) > 0:
        for _, row in session.weather_data.iterrows():
            weather_list.append({
                "time": float(row["Time"].total_seconds()),
                "air_temp": float(row["AirTemp"]) if not pd.isna(row["AirTemp"]) else 0.0,
                "track_temp": float(row["TrackTemp"]) if not pd.isna(row["TrackTemp"]) else 0.0,
                "humidity": float(row["Humidity"]) if not pd.isna(row["Humidity"]) else 0.0,
                "pressure": float(row["Pressure"]) if not pd.isna(row["Pressure"]) else 0.0,
                "wind_speed": float(row["WindSpeed"]) if not pd.isna(row["WindSpeed"]) else 0.0,
                "wind_direction": int(row["WindDirection"]) if not pd.isna(row["WindDirection"]) else 0,
                "rainfall": float(row["Rainfall"]) if not pd.isna(row["Rainfall"]) else 0.0
            })
    with open(os.path.join(output_dir, "weather.json"), "w") as f:
        json.dump(weather_list, f, indent=2)
        
    # 3. Process Race Control Messages
    print("Processing race control messages...")
    messages = []
    if session.race_control_messages is not None and len(session.race_control_messages) > 0:
        for _, row in session.race_control_messages.iterrows():
            messages.append({
                "time": float((row["Time"] - session.date).total_seconds()),
                "category": row["Category"],
                "message": row["Message"]
            })
    with open(os.path.join(output_dir, "race-control.json"), "w") as f:
        json.dump(messages, f, indent=2)
        
    # 4. Process Lap Crossing times
    print("Processing laps and sector timings...")
    laps_data = {}
    
    all_start_times = []
    all_end_times = []
    
    for driver in drivers_list:
        driver_laps = session.laps.pick_driver(driver)
        driver_laps_list = []
        
        for _, lap in driver_laps.iterrows():
            lap_num = lap["LapNumber"]
            
            lap_start_sec = lap["LapStartTime"].total_seconds() if not pd.isna(lap["LapStartTime"]) else None
            lap_end_sec = lap["Time"].total_seconds() if not pd.isna(lap["Time"]) else None
            
            if lap_start_sec is not None:
                all_start_times.append(lap_start_sec)
            if lap_end_sec is not None:
                all_end_times.append(lap_end_sec)
                
            s1 = lap["Sector1Time"].total_seconds() if not pd.isna(lap["Sector1Time"]) else None
            s2 = lap["Sector2Time"].total_seconds() if not pd.isna(lap["Sector2Time"]) else None
            s3 = lap["Sector3Time"].total_seconds() if not pd.isna(lap["Sector3Time"]) else None
            lap_time = lap["LapTime"].total_seconds() if not pd.isna(lap["LapTime"]) else None
            
            s1_elapsed = lap_start_sec + s1 if (lap_start_sec is not None and s1 is not None) else None
            s2_elapsed = s1_elapsed + s2 if (s1_elapsed is not None and s2 is not None) else None
            
            driver_laps_list.append({
                "lapNumber": int(lap_num),
                "lapTime": lap_time,
                "sector1": s1,
                "sector2": s2,
                "sector3": s3,
                "lapStartElapsed": lap_start_sec,
                "sector1Elapsed": s1_elapsed,
                "sector2Elapsed": s2_elapsed,
                "sector3Elapsed": lap_end_sec,
                "compound": str(lap["Compound"]) if not pd.isna(lap["Compound"]) else "UNKNOWN",
                "tyreLife": int(lap["TyreLife"]) if not pd.isna(lap["TyreLife"]) else 1,
                "isPit": True if (lap["TrackStatus"] == "2" or not pd.isna(lap["PitInTime"]) or not pd.isna(lap["PitOutTime"])) else False,
            })
            
        laps_data[driver] = driver_laps_list
        
    with open(os.path.join(output_dir, "laps.json"), "w") as f:
        json.dump(laps_data, f, indent=2)

    # ── Compute race_start_elapsed from lap-1 data ───────────────────────────
    # Use the minimum lap-1 start across all drivers (not just all_start_times which
    # includes every lap) so we get the actual lights-out moment.
    lap1_starts = []
    for driver_laps_list in laps_data.values():
        for lap in driver_laps_list:
            if lap["lapNumber"] == 1 and lap["lapStartElapsed"] is not None:
                lap1_starts.append(lap["lapStartElapsed"])
    race_start_elapsed = min(lap1_starts) if lap1_starts else (min(all_start_times) if all_start_times else 0.0)
    print(f"Race start elapsed: {race_start_elapsed:.2f}s")

    # ── Compute grid-slot coordinates from pos_data ─────────────────────────
    # Sample each car's broadcast pos_data at ~8s before lights-out, when cars are
    # sitting stationary on their starting grid slot. This is the same coordinate
    # frame as the chunk telemetry, so there is no frame mismatch on the canvas.
    #
    # Fallback: search the window [race_start - 60s, race_start - 2s] and pick the
    # sample where the car is most stationary (minimum speed across 3-sample window).
    SAMPLE_SECONDS_BEFORE_START = 8.0  # target: 8s before lights-out
    SEARCH_WINDOW_SEC = 60.0           # how far before race start to search

    grid_slots = {}
    target_t = race_start_elapsed - SAMPLE_SECONDS_BEFORE_START

    for driver in drivers_list:
        try:
            driver_num = drivers_meta[driver]["number"]
            if driver_num not in session.pos_data or len(session.pos_data[driver_num]) == 0:
                continue
            pos_tel = session.pos_data[driver_num]
            pt = pos_tel["SessionTime"].dt.total_seconds().values
            px = pos_tel["X"].values
            py = pos_tel["Y"].values

            # Remove NaN
            valid = ~np.isnan(px) & ~np.isnan(py)
            pt, px, py = pt[valid], px[valid], py[valid]
            if len(pt) == 0:
                continue

            # Try nearest sample to target_t first
            nearest_idx = int(np.argmin(np.abs(pt - target_t)))
            if abs(pt[nearest_idx] - target_t) < 15.0:
                # Good direct hit — use it
                grid_slots[driver] = [round(float(px[nearest_idx]), 1), round(float(py[nearest_idx]), 1)]
            else:
                # Search window: find the sample where the car is most stationary
                # (smallest displacement over a 3-sample window) within the search window
                window_mask = (pt >= race_start_elapsed - SEARCH_WINDOW_SEC) & (pt < race_start_elapsed - 1.0)
                if not np.any(window_mask):
                    continue
                w_idx = np.where(window_mask)[0]
                # Compute speed proxy: distance between sample i-1 and i+1
                speeds = np.full(len(w_idx), np.inf)
                for k, idx in enumerate(w_idx):
                    lo, hi = max(0, idx - 1), min(len(px) - 1, idx + 1)
                    speeds[k] = np.hypot(px[hi] - px[lo], py[hi] - py[lo])
                best_k = int(np.argmin(speeds))
                best_idx = w_idx[best_k]
                grid_slots[driver] = [round(float(px[best_idx]), 1), round(float(py[best_idx]), 1)]
        except Exception as e:
            print(f"Warning: Could not compute grid slot for {driver}: {e}")

    print(f"Grid slots computed from pos_data for {len(grid_slots)} drivers.")

    # ── Update meta.json with corrected gridSlots + raceStartElapsed ─────────
    meta["gridSlots"] = grid_slots
    meta["raceStartElapsed"] = round(race_start_elapsed, 3)
    with open(os.path.join(output_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Updated meta.json with gridSlots and raceStartElapsed.")

    # Extend pre-race window to 300s so the static grid phase is always captured
    min_time = race_start_elapsed - 300.0 if all_start_times else 0.0
    max_time = max(all_end_times) + 30 if all_end_times else 7200.0
    print(f"Session boundaries: start={min_time}s (race_start-300), end={max_time}s")
    
    # 5. Extract Position Telemetry & Resample to 5Hz
    print("Resampling position telemetry...")
    hz = 5
    step_sec = 1.0 / hz
    t_grid = np.arange(min_time, max_time, step_sec)
    
    resampled_positions = {driver: {"x": [], "y": [], "lap": []} for driver in drivers_list}
    
    for driver in drivers_list:
        print(f"Processing positions for {driver}...")
        try:
            driver_num = drivers_meta[driver]["number"]
            drv_laps = session.laps.pick_driver(driver)
            
            if driver_num in session.pos_data and len(session.pos_data[driver_num]) > 0:
                pos_telemetry = session.pos_data[driver_num]
                
                driver_times = pos_telemetry["SessionTime"].dt.total_seconds().values
                driver_x = pos_telemetry["X"].values
                driver_y = pos_telemetry["Y"].values
                
                # Clean coordinates
                valid_mask = ~np.isnan(driver_x) & ~np.isnan(driver_y)
                driver_times = driver_times[valid_mask]
                driver_x = driver_x[valid_mask]
                driver_y = driver_y[valid_mask]
                
                # Map times to lap numbers
                driver_lap = map_times_to_laps(driver_times, drv_laps)
                
                # Interpolate coordinates
                interp_x = np.interp(t_grid, driver_times, driver_x, left=np.nan, right=np.nan)
                interp_y = np.interp(t_grid, driver_times, driver_y, left=np.nan, right=np.nan)
                
                # Interpolate Lap Numbers (forward fill behavior)
                interp_lap = np.interp(t_grid, driver_times, driver_lap, left=0, right=driver_lap[-1] if len(driver_lap) > 0 else 0)
                interp_lap = np.round(interp_lap).astype(int)
                
                resampled_positions[driver]["x"] = [None if np.isnan(val) else round(float(val), 1) for val in interp_x]
                resampled_positions[driver]["y"] = [None if np.isnan(val) else round(float(val), 1) for val in interp_y]
                resampled_positions[driver]["lap"] = [int(val) for val in interp_lap]
            else:
                resampled_positions[driver]["x"] = [None] * len(t_grid)
                resampled_positions[driver]["y"] = [None] * len(t_grid)
                resampled_positions[driver]["lap"] = [0] * len(t_grid)
        except Exception as e:
            print(f"Warning: Could not load positions for {driver}: {e}")
            resampled_positions[driver]["x"] = [None] * len(t_grid)
            resampled_positions[driver]["y"] = [None] * len(t_grid)
            resampled_positions[driver]["lap"] = [0] * len(t_grid)
            
    # Write position chunks
    print("Writing position chunks...")
    chunk_size_sec = 60
    samples_per_chunk = chunk_size_sec * hz
    num_chunks = int(np.ceil(len(t_grid) / samples_per_chunk))
    
    for k in range(num_chunks):
        start_idx = k * samples_per_chunk
        end_idx = min(len(t_grid), (k + 1) * samples_per_chunk)
        
        chunk_t = t_grid[start_idx:end_idx]
        chunk_drivers = {}
        
        for driver in drivers_list:
            chunk_drivers[driver] = {
                "x": resampled_positions[driver]["x"][start_idx:end_idx],
                "y": resampled_positions[driver]["y"][start_idx:end_idx],
                "lap": resampled_positions[driver]["lap"][start_idx:end_idx]
            }
            
        chunk_data = {
            "chunkIndex": k,
            "startTime": float(chunk_t[0]),
            "endTime": float(chunk_t[-1]),
            "timestamps": [round(float(t), 2) for t in chunk_t],
            "drivers": chunk_drivers
        }
        
        chunk_path = os.path.join(output_dir, f"chunk_{k:04d}.json")
        with open(chunk_path, "w") as f:
            json.dump(chunk_data, f)
            
    # Write a small registry about the chunks
    chunks_registry = {
        "minTime": float(min_time),
        "maxTime": float(max_time),
        "hz": hz,
        "chunkSizeSec": chunk_size_sec,
        "totalChunks": num_chunks
    }
    with open(os.path.join(output_dir, "chunks_registry.json"), "w") as f:
        json.dump(chunks_registry, f, indent=2)
        
    # 6. Extract high-frequency lap telemetry for Telemetry Comparison panel
    print("Ingesting high-frequency driver/lap telemetry...")
    for driver in drivers_list:
        print(f"Processing detailed telemetry for {driver}...")
        try:
            drv_laps = session.laps.pick_driver(driver)
            session_telemetry = drv_laps.get_telemetry()
            if len(session_telemetry) > 0:
                times = session_telemetry["SessionTime"].dt.total_seconds().values
                lap_numbers = map_times_to_laps(times, drv_laps)
                
                session_telemetry["LapNumber"] = lap_numbers
                
                for lap_num, lap_tel in session_telemetry.groupby("LapNumber"):
                    lap_num = int(lap_num)
                    if lap_num == 0:
                        continue
                        
                    lap_row = drv_laps[drv_laps["LapNumber"] == lap_num]
                    if len(lap_row) > 0:
                        lap_time = lap_row.iloc[0]["LapTime"]
                        if pd.isna(lap_time):
                            continue
                    
                    distance = lap_tel["Distance"].values
                    if len(distance) > 0:
                        dist_rel = distance - distance[0]
                        speed = lap_tel["Speed"].values
                        throttle = lap_tel["Throttle"].values
                        brake = lap_tel["Brake"].values.astype(int)
                        rpm = lap_tel["RPM"].values
                        gear = lap_tel["nGear"].values.astype(int)
                        drs = lap_tel["DRS"].values.astype(int)
                        
                        step = max(1, len(distance) // 250)
                        
                        lap_data = {
                            "driver": driver,
                            "lap": lap_num,
                            "distance": [round(float(d), 1) for d in dist_rel[::step]],
                            "speed": [int(s) for s in speed[::step]],
                            "throttle": [int(t) for t in throttle[::step]],
                            "brake": [int(b) for b in brake[::step]],
                            "rpm": [int(r) for r in rpm[::step]],
                            "gear": [int(g) for g in gear[::step]],
                            "drs": [int(d) for d in drs[::step]]
                        }
                        
                        lap_path = os.path.join(telemetry_dir, f"{driver}_{lap_num}.json")
                        with open(lap_path, "w") as f:
                            json.dump(lap_data, f)
        except Exception as e:
            print(f"Warning: Could not process detailed laps telemetry for {driver}: {e}")
            
    # 7. Generate global index.json manifest
    generate_manifest()
    print("Ingestion complete!")

if __name__ == "__main__":
    # If called with 'manifest', just build index.json and exit
    if len(sys.argv) > 1 and sys.argv[1] == "manifest":
        generate_manifest()
        sys.exit(0)

    # Standardize to 2024 Monaco GP Race
    year = 2024
    event = "Monaco"
    session_type = "R"
    
    if len(sys.argv) > 1:
        year = int(sys.argv[1])
    if len(sys.argv) > 2:
        event = sys.argv[2]
    if len(sys.argv) > 3:
        session_type = sys.argv[3]
        
    ingest_session(year, event, session_type)
