"""
Seed 20 realistic Bengaluru incidents into citizen_grievances.
Run: python backend/scripts/seed_demo.py
Requires DATABASE_URL env var (or .env file in backend/).
"""
import os
import sys
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("DATABASE_URL not set")

INCIDENTS = [
    # (complaint_type, description, zone, corridor, location_text, lat, lng, severity, status, priority)
    ("accident", "Multi-vehicle collision near Silk Board flyover, ambulance requested",
     "South", "Electronic City Road", "Silk Board Junction", 12.9166927, 77.6232459, "Critical", "in_progress", "High"),
    ("signal_failure", "Traffic signal at Hebbal flyover non-functional, major backup",
     "North", "Bellary Road 1", "Hebbal Flyover Junction", 13.0423, 77.5906, "High", "submitted", "High"),
    ("accident", "Auto-rickshaw overturned at KR Circle, road partially blocked",
     "Central", "None", "K R Circle", 12.9765, 77.5863, "High", "submitted", "High"),
    ("event_congestion", "IPL match traffic causing 4km jam on Mysore Road",
     "West", "Mysore Road", "Toll Gate Mysore Road", 12.9574, 77.5519, "High", "in_progress", "High"),
    ("road_closure", "BBMP road widening work blocking two lanes on Tumkur Road",
     "Northwest", "Tumkur Road", "Yeshwanthpura Circle", 13.0178, 77.5568, "Medium", "submitted", "Medium"),
    ("accident", "Truck breakdown blocking fast lane on Bellary Road near Mekhri Circle",
     "North", "Bellary Road 1", "Mekhri Circle", 13.0145, 77.5838, "High", "submitted", "High"),
    ("illegal_parking", "40+ vehicles illegally parked near Koramangala Water Tank, blocking emergency access",
     "South", "Electronic City Road", "Koramangala Water Tank Junction", 12.9274, 77.6212, "Medium", "submitted", "Medium"),
    ("signal_failure", "Power outage affecting 3 signals at Nagavara ORR junction",
     "Northeast", "Outer Ring Road", "Nagavara ORR Junction", 13.0401, 77.6243, "High", "in_progress", "High"),
    ("accident", "Bus skidded into divider at Jalahalli Cross, minor injuries",
     "Northwest", "Tumkur Road", "Jalahalli Cross SM Circle", 13.0400, 77.5183, "High", "resolved", "High"),
    ("event_congestion", "Wedding procession blocking MG Road for 45 minutes",
     "Central", "None", "MG Road Brigade Road Junction", 12.9756, 77.6062, "Medium", "resolved", "Medium"),
    ("road_closure", "Water main burst near BEL Circle, road closed in both directions",
     "Northwest", "Tumkur Road", "BEL Circle", 13.0439, 77.5564, "Critical", "in_progress", "High"),
    ("accident", "Bike vs car collision at Marathahalli Bridge, traffic crawling",
     "East", "Outer Ring Road", "Marathahalli Bridge Junction", 12.9563, 77.7008, "High", "submitted", "High"),
    ("signal_failure", "Signals at SilkBoard malfunctioning since 8 AM, traffic police deployed",
     "South", "Electronic City Road", "Silk Board Junction", 12.9166, 77.6232, "High", "in_progress", "High"),
    ("event_congestion", "Political rally causing road closure near Town Hall Junction",
     "Central", "None", "Town Hall Junction", 12.9637, 77.5842, "High", "submitted", "High"),
    ("accident", "BMTC bus rear-ended near Devanahalli ORR, 2 lanes blocked",
     "East", "Outer Ring Road", "Deverabeesanahalli ORR Junction", 12.9310, 77.6863, "Critical", "submitted", "High"),
    ("road_closure", "Tree fallen across road after heavy rain near Hennur ORR junction",
     "Northeast", "Outer Ring Road", "Hennur Road ORR Junction", 13.0289, 77.6315, "High", "in_progress", "High"),
    ("illegal_parking", "Trucks parked on Peenya Industrial Area road, blocking heavy vehicle movement",
     "Northwest", "Tumkur Road", "SRS Peenya Junction", 13.0346, 77.5298, "Medium", "submitted", "Low"),
    ("accident", "Pothole caused bike fall near Shivajinagar BRV Junction, road marking faded",
     "Central", "None", "Shivajinagar BRV Junction", 12.9792, 77.6026, "Medium", "resolved", "Medium"),
    ("event_congestion", "Temple festival procession on Mysore Road causing 6km backup",
     "West", "Mysore Road", "Mysore Road Ring Road Junction", 12.9450, 77.5273, "High", "submitted", "High"),
    ("signal_failure", "CCTV and signal failure at Ayyappa Temple Junction, near accident reported",
     "Southeast", "Electronic City Road", "Ayyappa Temple Junction", 12.9238, 77.6186, "Critical", "in_progress", "High"),
]

TRACKING_PREFIX = "DRS-DEMO-"

def random_time_ago(max_hours: int = 6) -> datetime:
    minutes = random.randint(5, max_hours * 60)
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)

def main() -> None:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute("select tracking_id from citizen_grievances where tracking_id like %s limit 1",
                        (TRACKING_PREFIX + "%",))
            if cur.fetchone():
                print("Demo data already seeded. Delete rows with tracking_id LIKE 'DRS-DEMO-%' to re-seed.")
                return

            inserted = 0
            for i, inc in enumerate(INCIDENTS):
                (complaint_type, description, zone, corridor, location_text,
                 lat, lng, severity, status, priority) = inc
                tracking_id = f"{TRACKING_PREFIX}{i+1:02d}"
                created_at = random_time_ago(8)
                cur.execute(
                    """
                    insert into citizen_grievances
                        (tracking_id, complaint_type, description, zone, corridor,
                         location_text, latitude, longitude, severity, status,
                         priority, reporter_name, reporter_phone, created_at)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    on conflict (tracking_id) do nothing
                    """,
                    (tracking_id, complaint_type, description, zone, corridor,
                     location_text, lat, lng, severity, status,
                     priority, "Demo User", "9999900000", created_at)
                )
                inserted += 1

            conn.commit()
            print(f"Seeded {inserted} demo incidents.")

if __name__ == "__main__":
    main()
