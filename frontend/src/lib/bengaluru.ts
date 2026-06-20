export const bengaluruZones = [
  "Central Zone",
  "East Zone",
  "West Zone",
  "North Zone",
  "South Zone",
  "South-East Zone",
  "North-East Zone",
  "Whitefield Zone",
  "Electronic City Zone"
];

export const bengaluruCorridors = [
  "Outer Ring Road",
  "MG Road",
  "Hosur Road",
  "Old Madras Road",
  "Tumakuru Road",
  "Mysore Road",
  "Airport Road",
  "Bannerghatta Road",
  "Kanakapura Road",
  "Bellary Road",
  "Sarjapur Road",
  "HAL Airport Road",
  "KR Puram approach",
  "Silk Board approach",
  "Hebbal flyover approach"
];

// Exact categorical values present in the Astram model-training dataset.
export const modelCorridors = [
  "Airport New South Road",
  "Bannerghata Road",
  "Bellary Road 1",
  "Bellary Road 2",
  "CBD 1",
  "CBD 2",
  "Hennur Main Road",
  "Hosur Road",
  "IRR(Thanisandra road)",
  "Magadi Road",
  "Mysore Road",
  "Non-corridor",
  "ORR East 1",
  "ORR East 2",
  "ORR North 1",
  "ORR North 2",
  "ORR West 1",
  "Old Airport Road",
  "Old Madras Road",
  "Tumkur Road",
  "Varthur Road",
  "West of Chord Road",
] as const;

export const modelZones = [
  "Central Zone 1",
  "Central Zone 2",
  "East Zone 1",
  "East Zone 2",
  "North Zone 1",
  "North Zone 2",
  "South Zone 1",
  "South Zone 2",
  "West Zone 1",
  "West Zone 2",
] as const;

export const highSignalLocations = [
  {
    label: "Silk Board junction",
    zone: "South-East Zone",
    corridor: "Outer Ring Road",
    latitude: 12.9177,
    longitude: 77.6238
  },
  {
    label: "Trinity Circle",
    zone: "Central Zone",
    corridor: "MG Road",
    latitude: 12.9738,
    longitude: 77.6205
  },
  {
    label: "KR Puram cable bridge",
    zone: "East Zone",
    corridor: "KR Puram approach",
    latitude: 13.0005,
    longitude: 77.6757
  },
  {
    label: "Hebbal flyover",
    zone: "North Zone",
    corridor: "Hebbal flyover approach",
    latitude: 13.0358,
    longitude: 77.597,
  },
  {
    label: "Manyata Tech Park gate",
    zone: "North-East Zone",
    corridor: "Outer Ring Road",
    latitude: 13.0498,
    longitude: 77.6203
  }
];

export const complaintTypeLabels = {
  event_congestion: "Event congestion",
  illegal_parking: "Illegal parking",
  road_closure: "Road closure",
  accident_or_breakdown: "Accident or breakdown",
  signal_failure: "Signal failure",
  other: "Other"
} as const;

export const complaintTypeDescriptions = {
  event_congestion: "Rally, festival, match, procession, sudden gathering, or event spillover.",
  illegal_parking: "Carriageway blocked by parked vehicles or spillover parking.",
  road_closure: "Unexpected closure, barricade, diversion, or blocked lane.",
  accident_or_breakdown: "Crash, truck breakdown, stalled bus, or obstruction.",
  signal_failure: "Traffic signal not working, stuck phase, or unsafe crossing.",
  other: "Any other traffic disruption needing police attention."
} as const;

export const severityDescriptions = {
  Low: "Slowdown visible, but vehicles are moving.",
  Medium: "Queue forming and one approach affected.",
  High: "Multiple approaches blocked or public transport affected.",
  Critical: "Junction lock, safety risk, emergency route blocked, or crowd surge."
} as const;

export const enrouteCarryItems: Record<string, string[]> = {
  event_congestion:      ["Traffic cones ×6", "Barricades ×2", "High-vis vest", "Megaphone", "Radio"],
  illegal_parking:       ["Chalking kit", "Towing form", "Phone/camera for evidence", "High-vis vest"],
  road_closure:          ["Barricades ×4", "Diversion sign boards", "Reflective tape", "First aid kit"],
  accident_or_breakdown: ["First aid kit", "Fire extinguisher", "Traffic cones ×4", "Tow request form", "Flares"],
  signal_failure:        ["Manual traffic control vest", "Traffic cones ×6", "Signal override key", "Radio"],
  other:                 ["Traffic cones ×4", "High-vis vest", "Radio", "First aid kit"],
};
