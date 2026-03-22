const GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const toRad = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (fromCoords, toCoords) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(toCoords.lat - fromCoords.lat);
  const dLng = toRad(toCoords.lng - fromCoords.lng);
  const lat1 = toRad(fromCoords.lat);
  const lat2 = toRad(toCoords.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const geocodeCity = async (city) => {
  if (!city) {
    return null;
  }

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("q", city);
  url.searchParams.set("format", "json");
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

  const item = data[0];
  if (!item?.lat || !item?.lon) {
    return null;
  }

  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
  };
};

export const getDistanceAndDuration = async (fromCoords, toCoords) => {
  if (!fromCoords || !toCoords) {
    return null;
  }

  const distanceKm = calculateDistanceKm(fromCoords, toCoords);
  const averageSpeedKmH = 45;
  const durationHours = distanceKm / averageSpeedKmH;
  const durationMinutes = Math.max(1, Math.round(durationHours * 60));

  return {
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationText: `${durationMinutes} mins`,
  };
};
