import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapStyles.css";

const PAKISTAN_CENTER = [30.3753, 69.3451];
const DEFAULT_ZOOM = 6;

const createPinIcon = (className, label) =>
  L.divIcon({
    className: "",
    html: `<div class="map-pin ${className}" aria-label="${label}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

const riderIcon = createPinIcon("rider", "Rider marker");
const passengerIcon = createPinIcon("passenger", "Passenger marker");

const formatPoint = (latlng) => `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;

const buildOsrmRouteUrl = (pickup, drop) => {
  if (!pickup || !drop) {
    return null;
  }

  // Foundation for OSRM integration. You can fetch this URL later.
  return `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`;
};

export default function RideMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const animationRef = useRef(null);

  const currentMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);

  const [mapError, setMapError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [statusText, setStatusText] = useState("Tap map to select pickup and drop points.");
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);

  const osrmUrl = useMemo(() => buildOsrmRouteUrl(pickup, drop), [pickup, drop]);

  const clearRouteVisuals = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    if (dropMarkerRef.current) {
      map.removeLayer(dropMarkerRef.current);
      dropMarkerRef.current = null;
    }
  }, []);

  const drawRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !pickup || !drop) {
      return;
    }

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
    }

    routePolylineRef.current = L.polyline([pickup, drop], {
      color: "#2563eb",
      weight: 5,
      opacity: 0.85,
      lineJoin: "round",
    }).addTo(map);

    map.fitBounds(routePolylineRef.current.getBounds(), {
      padding: [40, 40],
      animate: true,
      duration: 0.4,
    });
  }, [pickup, drop]);

  const smoothMoveMarker = useCallback((targetLatLng) => {
    const marker = currentMarkerRef.current;
    const map = mapRef.current;

    if (!marker || !map) {
      return;
    }

    const start = marker.getLatLng();
    const startTime = performance.now();
    const duration = 700;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = start.lat + (targetLatLng.lat - start.lat) * eased;
      const lng = start.lng + (targetLatLng.lng - start.lng) * eased;

      marker.setLatLng({ lat, lng });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }, []);

  const updateCurrentLocation = useCallback((position) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const nextLatLng = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.marker(nextLatLng, { icon: riderIcon })
        .addTo(map)
        .bindPopup("You are here");
      currentMarkerRef.current.openPopup();
      map.setView(nextLatLng, 14, { animate: true });
      setStatusText(`Live location: ${formatPoint(nextLatLng)}`);
      return;
    }

    smoothMoveMarker(nextLatLng);
    map.panTo(nextLatLng, {
      animate: true,
      duration: 0.5,
    });
    setStatusText(`Live location: ${formatPoint(nextLatLng)}`);
  }, [smoothMoveMarker]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationError("");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateCurrentLocation(position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission denied. Please allow location access.");
        } else {
          setLocationError("Unable to track current location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      }
    );
  }, [updateCurrentLocation]);

  const handleFindMyLocation = useCallback(() => {
    setStatusText("Finding your location...");
    startTracking();
  }, [startTracking]);

  const handleStartRide = useCallback(() => {
    if (!pickup || !drop) {
      setStatusText("Select pickup and drop points first.");
      return;
    }

    setStatusText(`Ride started from ${formatPoint(pickup)} to ${formatPoint(drop)}.`);
  }, [pickup, drop]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: PAKISTAN_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
      });

      mapRef.current = map;

      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);

      const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      });

      tiles.on("tileerror", () => {
        setMapError("Map tiles failed to load. Check your internet connection.");
      });

      tiles.addTo(map);

      map.on("click", (event) => {
        const clicked = event.latlng;

        if (!pickup) {
          setPickup(clicked);
          const marker = L.marker(clicked, { icon: passengerIcon }).addTo(map).bindPopup("Pickup point");
          pickupMarkerRef.current = marker;
          marker.openPopup();
          setStatusText("Pickup selected. Now tap to set drop point.");
          return;
        }

        if (!drop) {
          setDrop(clicked);
          const marker = L.marker(clicked, { icon: riderIcon }).addTo(map).bindPopup("Drop point");
          dropMarkerRef.current = marker;
          marker.openPopup();
          setStatusText("Drop selected. Route ready.");
          return;
        }

        clearRouteVisuals();
        setPickup(clicked);
        setDrop(null);
        const marker = L.marker(clicked, { icon: passengerIcon }).addTo(map).bindPopup("Pickup point");
        pickupMarkerRef.current = marker;
        marker.openPopup();
        setStatusText("Route reset. Pickup updated, now select drop point.");
      });

      startTracking();
    } catch {
      setMapError("Map failed to initialize.");
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [clearRouteVisuals, drop, pickup, startTracking]);

  useEffect(() => {
    drawRoute();
  }, [drawRoute]);

  return (
    <div className="live-map-page">
      <div ref={mapContainerRef} className="live-map-canvas" />

      <div className="map-top-panel">
        <h1>Ride Map</h1>
        <p>{statusText}</p>
        {pickup && <p>Pickup: {formatPoint(pickup)}</p>}
        {drop && <p>Drop: {formatPoint(drop)}</p>}
        {osrmUrl && <p className="osrm-text">OSRM ready: {osrmUrl}</p>}
      </div>

      <div className="map-actions">
        <button type="button" className="map-btn" onClick={handleFindMyLocation}>
          Find My Location
        </button>
        <button type="button" className="map-btn map-btn-primary" onClick={handleStartRide}>
          Start Ride
        </button>
      </div>

      {(mapError || locationError) && (
        <div className="map-error-box" role="alert">
          {mapError || locationError}
        </div>
      )}
    </div>
  );
}
