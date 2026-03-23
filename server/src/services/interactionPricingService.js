import { Ride } from "../models/Ride.js";
import { getRouteDistanceAndDuration } from "./mapsService.js";

export const PRICING_CURRENCY = "PKR";

const RATE_PER_100KM = {
  driver: 100,
  passenger: 50,
};

export const calculateInteractionAmount = (distanceKm, role) => {
  const normalizedDistance = Math.max(0, Number(distanceKm || 0));
  const stepCount = Math.ceil(normalizedDistance / 100);
  const rate = RATE_PER_100KM[role] || RATE_PER_100KM.passenger;
  return stepCount * rate;
};

export const getRideDistanceKm = async (ride) => {
  if (!ride?.fromCoordinates || !ride?.toCoordinates) {
    return null;
  }

  const route = await getRouteDistanceAndDuration(ride.fromCoordinates, ride.toCoordinates);
  if (!route?.distanceKm) {
    return null;
  }

  return Number(route.distanceKm.toFixed(2));
};

export const getInteractionQuote = async ({ rideId, role }) => {
  const ride = await Ride.findById(rideId).select(
    "_id driver fromCity toCity fromCoordinates toCoordinates status totalSeats availableSeats bookedSeats"
  );

  if (!ride) {
    return null;
  }

  const distanceKm = await getRideDistanceKm(ride);
  if (distanceKm === null) {
    return {
      ride,
      distanceKm: 0,
      amount: 0,
      currency: PRICING_CURRENCY,
    };
  }

  return {
    ride,
    distanceKm,
    amount: calculateInteractionAmount(distanceKm, role),
    currency: PRICING_CURRENCY,
  };
};
