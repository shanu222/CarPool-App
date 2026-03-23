const GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const OSRM_ROUTE_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

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

  const routeMetrics = await getRouteDistanceAndDuration(fromCoords, toCoords);
  const distanceKm = routeMetrics?.distanceKm ?? calculateDistanceKm(fromCoords, toCoords);
  const durationMinutes = routeMetrics?.durationMinutes ?? Math.max(1, Math.round((distanceKm / 45) * 60));

  return {
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationText: `${durationMinutes} mins`,
  };
};

export const getRouteDistanceAndDuration = async (fromCoords, toCoords) => {
  if (!fromCoords || !toCoords) {
    return null;
  }

  const fallbackDistanceKm = calculateDistanceKm(fromCoords, toCoords);
  const fallbackDurationMinutes = Math.max(1, Math.round((fallbackDistanceKm / 45) * 60));

  try {
    const coordinates = `${Number(fromCoords.lng)},${Number(fromCoords.lat)};${Number(toCoords.lng)},${Number(toCoords.lat)}`;
    const url = new URL(`${OSRM_ROUTE_ENDPOINT}/${coordinates}`);
    url.searchParams.set("overview", "false");
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("steps", "false");

    const response = await fetch(url);
    if (!response.ok) {
      return {
        distanceKm: fallbackDistanceKm,
        durationMinutes: fallbackDurationMinutes,
      };
    }

    const data = await response.json();
    const firstRoute = Array.isArray(data?.routes) ? data.routes[0] : null;

    if (!firstRoute) {
      return {
        distanceKm: fallbackDistanceKm,
        durationMinutes: fallbackDurationMinutes,
      };
    }

    const distanceKm = Number(firstRoute.distance || 0) / 1000;
    const durationMinutes = Math.max(1, Math.round(Number(firstRoute.duration || 0) / 60));

    return {
      distanceKm: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : fallbackDistanceKm,
      durationMinutes,
    };
  } catch {
    return {
      distanceKm: fallbackDistanceKm,
      durationMinutes: fallbackDurationMinutes,
    };
  }
};
