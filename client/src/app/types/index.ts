export interface User {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: "passenger" | "driver";
  rating: number;
  ratingCount?: number;
  isVerified?: boolean;
  cnic?: string;
  profilePhoto?: string;
  licensePhoto?: string;
}

export interface Ride {
  _id: string;
  driver: User;
  fromCity: string;
  toCity: string;
  date: string;
  time: string;
  pricePerSeat: number;
  totalSeats: number;
  availableSeats: number;
  fromCoordinates?: {
    lat: number;
    lng: number;
  };
  toCoordinates?: {
    lat: number;
    lng: number;
  };
  distanceText?: string;
  durationText?: string;
  status?: "pending" | "ongoing" | "completed" | "cancelled";
}

export interface Booking {
  _id: string;
  user: User;
  ride: Ride;
  seatsBooked: number;
  totalPrice: number;
  status: "booked" | "ongoing" | "completed" | "cancelled";
  createdAt: string;
  driverNearNotified?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface NotificationItem {
  _id: string;
  type: "ride_posted" | "ride_booked" | "message" | "generic";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface Message {
  _id: string;
  ride: string;
  sender: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  receiver: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  text: string;
  createdAt: string;
}

export interface LiveLocation {
  _id?: string;
  rideId: string;
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface Review {
  _id: string;
  reviewerId: {
    _id: string;
    name: string;
    rating: number;
    isVerified?: boolean;
  };
  targetUserId: string;
  rideId: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
}
