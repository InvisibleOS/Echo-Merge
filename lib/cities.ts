export interface CityConfig {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  corporation: string;
}

export const CITIES: CityConfig[] = [
  {
    id: "bengaluru",
    name: "Bengaluru",
    lat: 12.9716,
    lng: 77.5946,
    zoom: 12,
    corporation: "BBMP",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    lat: 19.0760,
    lng: 72.8777,
    zoom: 11,
    corporation: "BMC",
  },
  {
    id: "delhi",
    name: "Delhi",
    lat: 28.6139,
    lng: 77.2090,
    zoom: 11,
    corporation: "NDMC",
  },
  {
    id: "chennai",
    name: "Chennai",
    lat: 13.0827,
    lng: 80.2707,
    zoom: 12,
    corporation: "GCC",
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    lat: 17.3850,
    lng: 78.4867,
    zoom: 11.5,
    corporation: "GHMC",
  },
  {
    id: "pune",
    name: "Pune",
    lat: 18.5204,
    lng: 73.8567,
    zoom: 12,
    corporation: "PMC",
  },
];
