export interface User {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: "admin" | "passenger" | "driver";
  status?: "pending" | "approved" | "suspended" | "banned";
  isBlocked?: boolean;
  accountStatus?: "active" | "suspended" | "banned";
  suspensionReason?: string;
  rating: number;
  ratingCount?: number;
  isVerified?: boolean;
  verificationStatus?: "none" | "pending" | "approved" | "rejected";
  cnicNumber?: string;
  cnicPhoto?: string;
  maskedCnic?: string;
  cnic?: string;
  profilePhoto?: string;
  carPhoto?: string;
  carMake?: string;
  carModel?: string;
  carColor?: string;
  carPlateNumber?: string;
  carYear?: number;
  licensePhoto?: string;
  canPostRide?: boolean;
  canBookRide?: boolean;
  canChat?: boolean;
  paymentApproved?: boolean;
  blockedUsers?: string[];
}

export interface Ride {
  _id: string;
  driver: User;
  fromCity: string;
  toCity: string;
  date: string;
  time: string;
  dateTime?: string;
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
  distanceKm?: number;
  status?: "scheduled" | "ongoing" | "completed" | "cancelled";
  featured?: boolean;
  featuredAt?: string;
}

export interface Booking {
  _id: string;
  passengerId?: User;
  rideId?: string;
  user: User;
  ride: Ride;
  seatsRequested?: number;
  seatsBooked: number;
  totalPrice: number;
  status: "pending" | "accepted" | "rejected" | "ongoing" | "completed" | "cancelled";
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
  clientMessageId?: string | null;
  ride: string;
  rideId?: string;
  sender: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  senderId?: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  receiver: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  receiverId?: {
    _id: string;
    name: string;
    role: "passenger" | "driver";
  };
  text: string;
  message?: string;
  isSeen?: boolean;
  timestamp?: string;
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

export interface Payment {
  _id: string;
  userId: User;
  role?: "passenger" | "driver";
  type: "ride_post" | "booking_unlock";
  amount: number;
  method: "easypaisa" | "jazzcash" | "bank";
  screenshot?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: Pick<User, "id" | "_id" | "name" | "email">;
  rejectionReason?: string;
  createdAt: string;
}

export interface PaymentSettings {
  _id?: string;
  easypaisaNumber: string;
  jazzcashNumber: string;
  bankAccount: string;
  accountTitle: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  totalRides: number;
  totalEarnings: number;
  activeRides: number;
}

export interface RideSearchResponse {
  liveRides: Ride[];
  upcomingRides: Ride[];
  rides: Ride[];
}

export interface RideRequest {
  _id: string;
  passengerId: User;
  fromCity: string;
  toCity: string;
  fromCoordinates: {
    lat: number;
    lng: number;
  };
  toCoordinates: {
    lat: number;
    lng: number;
  };
  dateTime: string;
  seatsNeeded: number;
  status: "open" | "matched" | "completed";
  distanceKm?: number;
  matchedRideId?: string;
  matchedBookingId?: string;
}
