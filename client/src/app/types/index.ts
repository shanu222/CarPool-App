export interface User {
  id: string;
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
