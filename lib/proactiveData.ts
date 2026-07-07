"use client";

import { GeoPoint } from "./types";

export type ProactivePriorityLevel = "Critical" | "Warning" | "Monitor" | "High" | "Medium";
export type IngestionType = "SCADA Telemetry" | "Computer Vision (CV)" | "News Feeds (NLP)";

export interface ProactiveAlert {
  id: string;
  source: string;
  source_tooltip: string; // e.g., "Source: BWSSB SCADA"
  ingestion_type: IngestionType;
  predictive_status: "System-Detected" | "Confirmed";
  title: string;
  category: string; // Water, Drainage, Road, Electricity, etc.
  priority: ProactivePriorityLevel;
  timestamp: string;
  geo: GeoPoint;
  location_label: string;
  details: string;
  suggested_action: string;
  department: string;
}

/** Simulated automated scraping and telemetry crawling data for proactive governance */
export const PROACTIVE_ALERTS: ProactiveAlert[] = [
  {
    id: "PRO_001",
    source: "Municipal Water Pressure Telemetry Network",
    source_tooltip: "Source: Water Board SCADA",
    ingestion_type: "SCADA Telemetry",
    predictive_status: "System-Detected",
    title: "Severe pressure drop detected across 4 distribution nodes",
    category: "Water Supply and Services",
    priority: "Critical",
    timestamp: "12 mins ago",
    geo: { lat: 12.9165, lng: 77.6101 }, // BTM Layout 2nd Stage
    location_label: "BTM Layout 2nd Stage (Node W-402)",
    details: "Automated crawl of municipal SCADA telemetry indicates a 42% pressure drop in morning supply lines. Possible subsurface pipe rupture or illegal diversion.",
    suggested_action: "Dispatch the water board's acoustic leak detection team immediately before citizen complaints spike.",
    department: "State Water Supply & Sewerage Board",
  },
  {
    id: "PRO_002",
    source: "Municipal Monsoon Drain Monitoring Cameras",
    source_tooltip: "Source: Municipal CV Feed #19",
    ingestion_type: "Computer Vision (CV)",
    predictive_status: "System-Detected",
    title: "Silt & solid waste blockage at major stormwater conduit",
    category: "Sanitation", // Mapped to Drainage/Sanitation
    priority: "Critical",
    timestamp: "28 mins ago",
    geo: { lat: 12.9352, lng: 77.6245 }, // Koramangala 4th Block
    location_label: "Koramangala 4th Block (Drain C-19)",
    details: "Automated computer vision crawl of municipal drain monitoring cameras identified 75% flow obstruction caused by dumped construction debris and plastics.",
    suggested_action: "Deploy mechanical excavator and solid waste clearance crew prior to evening monsoon showers.",
    department: "Municipal Solid Waste & Drainage Department",
  },
  {
    id: "PRO_003",
    source: "Local Civic News Scraper (Deccan Herald / Public Eye)",
    source_tooltip: "Source: Civic News NLP Crawl",
    ingestion_type: "News Feeds (NLP)",
    predictive_status: "System-Detected",
    title: "High-voltage transformer oil leakage reported by neighborhood watch",
    category: "Electricity and Power Supply",
    priority: "Warning",
    timestamp: "1 hour ago",
    geo: { lat: 12.9229, lng: 77.5852 }, // Jayanagar 4th Block
    location_label: "Jayanagar 4th Block Shopping Complex",
    details: "NLP news crawler aggregated 4 independent social civic posts and local news tickers warning of overheating and oil dripping from 250kVA transformer feeder.",
    suggested_action: "Schedule emergency DISCOM thermal inspection and bushing replacement during off-peak window.",
    department: "State Electricity Distribution Company (DISCOM)",
  },
  {
    id: "PRO_004",
    source: "Municipal Traffic Camera Pavement Analysis Scraper",
    source_tooltip: "Source: Traffic Cam CV",
    ingestion_type: "Computer Vision (CV)",
    predictive_status: "System-Detected",
    title: "Rapid asphalt degradation & pothole cluster developing",
    category: "Mobility - Roads, Footpaths and Infrastructure",
    priority: "Warning",
    timestamp: "2 hours ago",
    geo: { lat: 12.9081, lng: 77.5753 }, // Banashankari 2nd Stage
    location_label: "Banashankari 2nd Stage Outer Ring Road Junction",
    details: "Traffic camera computer vision surface crawl flagged a 6-meter stretch of crumbling bitumen with standing water, slowing traffic flow by 35% during rush hour.",
    suggested_action: "Assign PWD rapid road patching unit for cold-mix asphalt repair.",
    department: "Public Works Department (PWD) / Municipal Roads",
  },
  {
    id: "PRO_005",
    source: "Public Health Open Data Portal Scraper",
    source_tooltip: "Source: Public Health NLP",
    ingestion_type: "News Feeds (NLP)",
    predictive_status: "System-Detected",
    title: "Localized spike in mosquito vector density index",
    category: "Sanitation",
    priority: "Monitor",
    timestamp: "3 hours ago",
    geo: { lat: 12.8997, lng: 77.5963 }, // JP Nagar 6th Phase
    location_label: "JP Nagar 6th Phase Lake Periphery",
    details: "Scraping of weekly health inspector sample logs shows a 3x increase in dengue vector larvae near stagnant marshland pockets.",
    suggested_action: "Deploy municipal fogging and larvicide spraying unit across a 500m radius.",
    department: "Municipal Health & Sanitation Department",
  },
  {
    id: "PRO_006",
    source: "Smart City Streetlight IoT Gateway Crawl",
    source_tooltip: "Source: Streetlight SCADA",
    ingestion_type: "SCADA Telemetry",
    predictive_status: "System-Detected",
    title: "Feeder circuit trip affecting 18 street lamps",
    category: "Electricity and Power Supply",
    priority: "Monitor",
    timestamp: "5 hours ago",
    geo: { lat: 12.9121, lng: 77.6351 }, // HSR Layout Sector 2
    location_label: "HSR Layout Sector 2 (27th Main)",
    details: "Automated query of smart IoT streetlight SCADA controllers revealed an automated breaker trip, leaving 400m of residential sidewalk unlit.",
    suggested_action: "Dispatch electrical maintenance contractor to reset feeder and inspect circuit insulation.",
    department: "Municipal Electrical Engineering Wing / DISCOM",
  },
  {
    id: "PRO_007",
    source: "Mumbai Suburban Train CCTV NLP",
    source_tooltip: "Source: Western Railway CV",
    ingestion_type: "Computer Vision (CV)",
    predictive_status: "System-Detected",
    title: "Severe waterlogging on local train tracks",
    category: "Sanitation", // Drainage
    priority: "Critical",
    timestamp: "18 mins ago",
    geo: { lat: 19.0163, lng: 72.8296 }, // Prabhadevi Station
    location_label: "Mumbai - Prabhadevi Local Station",
    details: "CCTV feeds indicate 2ft of water accumulation on tracks disrupting local train schedules.",
    suggested_action: "Deploy heavy-duty dewatering pumps from BMC ward office.",
    department: "Brihanmumbai Municipal Corporation (BMC)",
  },
  {
    id: "PRO_008",
    source: "Delhi Air Quality Index IoT Network",
    source_tooltip: "Source: NDMC AQI Sensors",
    ingestion_type: "SCADA Telemetry",
    predictive_status: "System-Detected",
    title: "Hazardous PM2.5 Spike detected in localized area",
    category: "Sanitation", // Waste Burning
    priority: "Warning",
    timestamp: "45 mins ago",
    geo: { lat: 28.5273, lng: 77.2089 }, // Saket
    location_label: "Delhi - Saket Sector 6",
    details: "Sudden AQI spike to 450+ indicates localized illegal industrial waste burning in open ground.",
    suggested_action: "Dispatch NDMC environmental enforcement squad.",
    department: "New Delhi Municipal Council (NDMC)",
  },
  {
    id: "PRO_009",
    source: "Chennai Metro Water SCADA",
    source_tooltip: "Source: CMWSSB Telemetry",
    ingestion_type: "SCADA Telemetry",
    predictive_status: "Confirmed",
    title: "Major main line burst leading to flooding",
    category: "Water Supply and Services",
    priority: "Critical",
    timestamp: "10 mins ago",
    geo: { lat: 13.0475, lng: 80.2090 }, // T. Nagar
    location_label: "Chennai - T. Nagar Main",
    details: "Pressure dropped to zero. Reports of street flooding confirm main pipeline rupture.",
    suggested_action: "Shut off sector valve and dispatch CMWSSB emergency repair crew.",
    department: "Chennai Metropolitan Water Supply (CMWSSB)",
  },
  {
    id: "PRO_010",
    source: "Hyderabad Traffic Command Center",
    source_tooltip: "Source: Cyberabad Traffic CV",
    ingestion_type: "Computer Vision (CV)",
    predictive_status: "System-Detected",
    title: "Flyover Expansion Joint Failure",
    category: "Mobility - Roads, Footpaths and Infrastructure",
    priority: "Critical",
    timestamp: "1 hour ago",
    geo: { lat: 17.4435, lng: 78.3772 }, // HITEC City
    location_label: "Hyderabad - HITEC City Flyover",
    details: "Traffic cameras show dangerous separation in flyover expansion joint causing vehicle damage.",
    suggested_action: "Immediately divert heavy traffic and assign GHMC structural engineers.",
    department: "Greater Hyderabad Municipal Corporation (GHMC)",
  }
];
