import { pakistanCities } from "../data/pakistanCities.js";

export const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.5,
  minLng: 60.5,
  maxLng: 77.5,
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const normalizeCity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const cityMap = new Map(pakistanCities.map((city) => [normalizeCity(city), city]));

export const isKnownPakistanCity = (city) => cityMap.has(normalizeCity(city));

export const getKnownPakistanCity = (city) => cityMap.get(normalizeCity(city)) || null;

export const isWithinPakistanBounds = (coords) => {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return lat >= PAKISTAN_BOUNDS.minLat && lat <= PAKISTAN_BOUNDS.maxLat && lng >= PAKISTAN_BOUNDS.minLng && lng <= PAKISTAN_BOUNDS.maxLng;
};

export const searchNominatimCity = async (city) => {
  const value = String(city || "").trim();
  if (!value) {
    return null;
  }

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", value);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CarpoolApp/1.0 (contact: support@carpool-app.local)",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  const item = data[0] || {};
  const lat = Number(item.lat);
  const lng = Number(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const country = String(item?.address?.country || "").trim();

  return {
    city: String(item?.name || value).trim(),
    lat,
    lng,
    country,
  };
};
