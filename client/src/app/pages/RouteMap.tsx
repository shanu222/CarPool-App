import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";
import type { Ride } from "../types";

type Coordinates = {
  lat: number;
  lng: number;
};

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: number[][];
  };
  legs?: Array<{
    steps?: Array<{
      maneuver?: {
        instruction?: string;
      };
    }>;
  }>;
};

type OsrmDirectionsResponse = {
  routes?: OsrmRoute[];
};

const PAKISTAN_CENTER: LatLngExpression = [30.3753, 69.3451];

const markerIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const pickupIcon = markerIcon("#16a34a");
const dropIcon = markerIcon("#2563eb");

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      return;
    }

    map.fitBounds(points, { padding: [28, 28] });
  }, [map, points]);

  return null;
}

const formatKm = (meters?: number) => {
  if (!Number.isFinite(meters || 0)) {
    return "-";
  }

  return `${((meters || 0) / 1000).toFixed(1)} km`;
};

const formatEta = (seconds?: number) => {
  if (!Number.isFinite(seconds || 0)) {
    return "-";
  }

  const totalMinutes = Math.max(1, Math.round((seconds || 0) / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const toCoord = (value?: Coordinates | null): Coordinates | null => {
  if (!value) {
    return null;
  }

  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

export function RouteMap() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [routePoints, setRoutePoints] = useState<Array<[number, number]>>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | undefined>();
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>();
  const [steps, setSteps] = useState<string[]>([]);

  const pickup = useMemo(
    () => toCoord(ride?.pickupLocation || ride?.fromCoordinates || null),
    [ride?.pickupLocation, ride?.fromCoordinates]
  );

  const drop = useMemo(
    () => toCoord(ride?.dropLocation || ride?.toCoordinates || null),
    [ride?.dropLocation, ride?.toCoordinates]
  );

  const mapCenter: LatLngExpression = useMemo(() => {
    if (pickup) {
      return [pickup.lat, pickup.lng];
    }

    return PAKISTAN_CENTER;
  }, [pickup]);

  useEffect(() => {
    const loadRide = async () => {
      if (!rideId) {
        setError("Ride ID is missing");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await api.get<Ride>(`/api/rides/${rideId}`);
        setRide(response.data);
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || "Could not load ride route");
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideId]);

  useEffect(() => {
    const loadDirections = async () => {
      if (!pickup || !drop) {
        setRoutePoints([]);
        setSteps([]);
        setDistanceMeters(undefined);
        setDurationSeconds(undefined);
        return;
      }

      try {
        const endpoint = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}`;
        const params = new URLSearchParams({
          overview: "full",
          geometries: "geojson",
          steps: "true",
        });

        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Directions lookup failed");
        }

        const data = (await response.json()) as OsrmDirectionsResponse;
        const route = data.routes?.[0];
        const coordinates = route?.geometry?.coordinates || [];
        const points: Array<[number, number]> = coordinates
          .filter((item) => Array.isArray(item) && item.length >= 2)
          .map((item) => [Number(item[1]), Number(item[0])]);

        if (!points.length) {
          throw new Error("No road route found");
        }

        setRoutePoints(points);
        setDistanceMeters(route?.distance);
        setDurationSeconds(route?.duration);
        setSteps(
          (route?.legs?.[0]?.steps || [])
            .map((step) => String(step?.maneuver?.instruction || "").trim())
            .filter(Boolean)
            .slice(0, 8)
        );
      } catch {
        setError("Could not load road route. Try again shortly.");
        setRoutePoints([]);
        setDistanceMeters(undefined);
        setDurationSeconds(undefined);
        setSteps([]);
      }
    };

    loadDirections();
  }, [pickup, drop]);

  if (loading) {
    return <div className="p-6">Loading map...</div>;
  }

  if (!ride) {
    return <div className="p-6">{error || "Ride route unavailable"}</div>;
  }

  return (
    <div className="min-h-screen bg-transparent px-4 pb-24 pt-4">
      <div className="glass-panel sticky top-2 z-10 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 text-white/90">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg text-white">Open Map</h1>
            <p className="text-xs text-slate-100">{ride.fromCity} to {ride.toCity}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/20 bg-white">
        <div className="h-[62vh] w-full">
          <MapContainer center={mapCenter} zoom={11} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {routePoints.length ? (
              <Polyline positions={routePoints} pathOptions={{ color: "#2563eb", weight: 5 }} />
            ) : null}

            {pickup ? <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} /> : null}
            {drop ? <Marker position={[drop.lat, drop.lng]} icon={dropIcon} /> : null}

            <FitBounds points={routePoints.length ? routePoints : pickup && drop ? [[pickup.lat, pickup.lng], [drop.lat, drop.lng]] : []} />
          </MapContainer>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="glass-panel rounded-2xl p-3 text-sm text-slate-100">
          <div className="flex items-center justify-between">
            <span>Distance</span>
            <span className="font-medium text-white">{formatKm(distanceMeters)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>ETA</span>
            <span className="font-medium text-white">{formatEta(durationSeconds)}</span>
          </div>
          {error ? <p className="mt-2 text-xs text-amber-200">{error}</p> : null}
        </div>

        {steps.length ? (
          <div className="glass-panel rounded-2xl p-3">
            <h2 className="text-sm text-white">Turn-by-turn route</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-100">
              {steps.map((step, index) => (
                <li key={`${step}-${index}`}>{index + 1}. {step}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
