const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const DISTANCE_MATRIX_ENDPOINT = "https://maps.googleapis.com/maps/api/distancematrix/json";

const getMapsKey = () => process.env.GOOGLE_MAPS_API_KEY;

export const geocodeCity = async (city) => {
  const apiKey = getMapsKey();

  if (!apiKey || !city) {
    return null;
  }

  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("address", city);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  const location = data.results[0]?.geometry?.location;

  if (!location) {
    return null;
  }

  return {
    lat: location.lat,
    lng: location.lng,
  };
};

export const getDistanceAndDuration = async (fromCoords, toCoords) => {
  const apiKey = getMapsKey();

  if (!apiKey || !fromCoords || !toCoords) {
    return null;
  }

  const url = new URL(DISTANCE_MATRIX_ENDPOINT);
  url.searchParams.set("origins", `${fromCoords.lat},${fromCoords.lng}`);
  url.searchParams.set("destinations", `${toCoords.lat},${toCoords.lng}`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const element = data?.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    return null;
  }

  return {
    distanceText: element.distance?.text,
    durationText: element.duration?.text,
  };
};
