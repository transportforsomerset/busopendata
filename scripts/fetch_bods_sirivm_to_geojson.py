#!/usr/bin/env python3
"""
Fetch live SIRI-VM from BODS → convert vehicle positions to GeoJSON points
"""
import os
import sys
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from geojson import Feature, FeatureCollection, Point, dump

API_KEY = os.environ.get("BODS_API_KEY")
if not API_KEY:
    print("Error: BODS_API_KEY secret is not set", file=sys.stderr)
    sys.exit(1)

URL = f"https://data.bus-data.dft.gov.uk/timetable/download/siri-vm?api_key={API_KEY}"

OUTPUT_FILE = "live-bus-positions.geojson"

NS = {
    "s": "http://www.siri.org.uk/siri",
    "vm": "http://www.siri.org.uk/VM",
}

def main():
    print(f"Fetching live vehicle positions at {datetime.utcnow().isoformat()}Z")

    try:
        r = requests.get(URL, timeout=45)
        r.raise_for_status()
    except Exception as e:
        print(f"Failed to download SIRI-VM: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        root = ET.fromstring(r.content)
    except ET.ParseError as e:
        print(f"Invalid XML: {e}", file=sys.stderr)
        sys.exit(1)

    features = []

    # Find all VehicleActivity elements
    for va in root.findall(".//s:VehicleActivity", NS):
        mv = va.find("s:MonitoredVehicleJourney", NS)
        if mv is None:
            continue

        # Location
        loc = mv.find("s:VehicleLocation", NS)
        if loc is None:
            continue

        lat = loc.find("s:Latitude", NS)
        lon = loc.find("s:Longitude", NS)
        if lat is None or lon is None:
            continue

        try:
            lat = float(lat.text)
            lon = float(lon.text)
        except (ValueError, TypeError):
            continue

        # Optional useful properties
        props = {}

        # Operator / line / vehicle
        for tag, key in [
            ("s:LineRef", "line"),
            ("s:OperatorRef", "operator"),
            ("s:VehicleRef", "vehicle"),
            ("s:PublishedLineName", "published_line"),
            ("s:DirectionRef", "direction"),
            ("s:OriginRef", "origin"),
            ("s:DestinationRef", "destination"),
        ]:
            el = mv.find(tag, NS)
            if el is not None and el.text:
                props[key] = el.text.strip()

        # Bearing, speed, etc.
        bearing = mv.find("s:Bearing", NS)
        if bearing is not None and bearing.text:
            props["bearing"] = float(bearing.text)

        delay = va.find("s:MonitoredCall/s:VehicleAtStop", NS)  # simplistic
        if delay is not None:
            props["at_stop"] = delay.text == "true"

        # Timestamp
        recorded = va.find("s:RecordedAtTime", NS)
        if recorded is not None and recorded.text:
            props["recorded_at"] = recorded.text

        feature = Feature(
            geometry=Point((lon, lat)),
            properties=props
        )
        features.append(feature)

    collection = FeatureCollection(features)

    print(f"Generated {len(features)} vehicle features")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        dump(collection, f, indent=2, ensure_ascii=False)

    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
