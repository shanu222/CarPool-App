// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { LiveLocation, Ride } from "../types";

type RideMapProps = {
  ride: Ride;
  currentUserId: string;
  isDriver: boolean;
};

const PAKISTAN_CENTER: LatLngExpression = [30.3753, 69.3451];

const toRad = (value: number) => (value * Math.PI) / 180;
const kmDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.28);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const driverIcon = createMarkerIcon("#2563eb");
const passengerIcon = createMarkerIcon("#16a34a");

function AutoCenter({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) {
      return;
    }

    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), {
      duration: 0.6,
    });
  }, [map, target]);

  return null;
}

export function LiveRideMap({ ride, currentUserId, isDriver }: RideMapProps) {
    const isOngoing = ride.status === 'ongoing';

  const socketRef = useRef(getSocket());
  const watchIdRef = useRef<number | null>(null);
  const lastEmitRef = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  const routePoints = useMemo(() => {
    if (!ride.fromCoordinates || !ride.toCoordinates) {
      return null;
    }

    return [
      [ride.fromCoordinates.lat, ride.fromCoordinates.lng],
      [ride.toCoordinates.lat, ride.toCoordinates.lng],
    ] as LatLngExpression[];
  }, [ride.fromCoordinates, ride.toCoordinates]);

  const remainingDistance = useMemo(() => {
    if (!driverLocation || !ride.toCoordinates) {
      return null;
    }

    const km = kmDistance(driverLocation, ride.toCoordinates);
    const etaMinutes = Math.max(1, Math.round((km / 45) * 60));
    return {
      km: km.toFixed(1),
      etaMinutes,
    };
  }, [driverLocation, ride.toCoordinates]);

  const mapCenter: LatLngExpression = useMemo(() => {
    if (driverLocation) {
      return [driverLocation.lat, driverLocation.lng];
    }

    if (ride.fromCoordinates) {
      return [ride.fromCoordinates.lat, ride.fromCoordinates.lng];
    }

    return PAKISTAN_CENTER;
  }, [driverLocation, ride.fromCoordinates]);

  const emitLocation = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const socket = socketRef.current;
      if (!socket || !ride?._id) {
        return;
      }

      socket.emit("share_location", {
        rideId: ride._id,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    [ride?._id]
  );

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser");
      return;
    }

    setSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMyLocation(next);
        setDriverLocation(next);
        const now = Date.now();
        if (now - lastEmitRef.current >= 4000) {
          emitLocation(position.coords);
          lastEmitRef.current = now;
        }
      },
      (error) => {
        setSharing(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied");
        } else {
          toast.error("Could not track live location");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );
  }, [emitLocation]);

  const stopLocationSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setSharing(false);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !ride?._id || !isOngoing) {
      return;
    }

    socket.emit("join_ride_room", { rideId: ride._id });

    const onLocationUpdate = (payload: LiveLocation) => {
      if (payload.rideId !== ride._id) {
        return;
      }

      const isDriverUpdate = payload.userId === ride.driver.id || payload.userId === ride.driver._id;
      if (!isDriverUpdate) {
        return;
      }

      setDriverLocation({ lat: payload.latitude, lng: payload.longitude });
    };

    socket.on("location:update", onLocationUpdate);
    socket.on("location:receive", onLocationUpdate);
    socket.on("location_update", onLocationUpdate);

    return () => {
      socket.off("location:update", onLocationUpdate);
      socket.off("location:receive", onLocationUpdate);
      socket.off("location_update", onLocationUpdate);
    };
  }, [isOngoing, ride._id, ride.driver.id, ride.driver._id]);

  useEffect(() => {
    if (!isOngoing) {
      return;
    }

    const loadLatestDriverLocation = async () => {
      try {
        const response = await api.get<LiveLocation>(`/api/locations/latest/${ride._id}`);
        setDriverLocation({ lat: response.data.latitude, lng: response.data.longitude });
      } catch {
        // no-op when no location exists yet
      }
    };

    loadLatestDriverLocation();
  }, [isOngoing, ride._id]);

  useEffect(
    () => () => {
      stopLocationSharing();
    },
    [stopLocationSharing]
  );

  const emergencyShare = async () => {
    const point = driverLocation || myLocation || ride.fromCoordinates;

    if (!point) {
      toast.error("Location is not available yet");
      return;
    }

    const link = `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Emergency location", text: "Track my live location", url: link });
      } catch {
        // user cancelled
      }
      return;
    }

    await navigator.clipboard.writeText(link);
    toast.success("Emergency location link copied");
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <div className="h-72 w-full">
        <MapContainer center={mapCenter} zoom={12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routePoints ? <Polyline positions={routePoints} pathOptions={{ color: "#2563eb", weight: 4 }} /> : null}

          {ride.fromCoordinates ? (
            <Marker position={[ride.fromCoordinates.lat, ride.fromCoordinates.lng]} icon={passengerIcon} />
          ) : null}

          {ride.toCoordinates ? (
            <Marker position={[ride.toCoordinates.lat, ride.toCoordinates.lng]} icon={driverIcon} />
          ) : null}

          {driverLocation ? <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} /> : null}
          {myLocation && !isDriver ? <Marker position={[myLocation.lat, myLocation.lng]} icon={passengerIcon} /> : null}

          <AutoCenter target={driverLocation} />
        </MapContainer>
      </div>

      <div className="p-4 space-y-3">
        {isOngoing && remainingDistance ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Distance remaining</span>
            <span className="font-medium">{remainingDistance.km} km</span>
          </div>
        ) : null}

        {isOngoing && remainingDistance ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">ETA</span>
            <span className="font-medium">{remainingDistance.etaMinutes} mins</span>
          </div>
        ) : null}

        {!isOngoing ? (
          <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Scheduled ride: showing static route and points.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-2">
          {isDriver && isOngoing ? (
            <button
              type="button"
              onClick={sharing ? stopLocationSharing : startLocationSharing}
              className={`rounded-xl px-3 py-2 text-sm ${sharing ? "bg-red-100 text-red-700" : "bg-blue-600 text-white"}`}
            >
              {sharing ? "Stop Sharing" : "Share Live Location"}
            </button>
          ) : (
            <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-sm text-blue-700">
              {isOngoing ? 'Watching driver live' : 'Ride not live yet'}
            </div>
          )}

          <button
            type="button"
            onClick={emergencyShare}
            className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800"
          >
            Emergency
          </button>
        </div>
      </div>
    </div>
  );
}
