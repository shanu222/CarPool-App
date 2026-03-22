export interface User {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: "passenger" | "driver";
  rating: number;
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
}

export interface Booking {
  _id: string;
  user: User;
  ride: Ride;
  seatsBooked: number;
  totalPrice: number;
  status: "booked" | "cancelled";
  createdAt: string;
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
