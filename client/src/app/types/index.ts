export interface User {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  maskedPhone?: string;
  role: "admin" | "passenger" | "driver";
  status?: "pending" | "approved" | "suspended" | "banned";
  isBlocked?: boolean;
  accountStatus?: "active" | "suspended" | "banned";
  suspensionReason?: string;
  rating: number;
  ratingCount?: number;
  isVerified?: boolean;
  isFeatured?: boolean;
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
  notificationSettings?: {
    messages: boolean;
    rides: boolean;
    payments: boolean;
  };
}

export interface ChangeRequest {
  _id: string;
  userId: User;
  type: "cnic_update" | "car_update";
  currentData: Record<string, unknown>;
  requestedData: Record<string, unknown>;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: Pick<User, "id" | "_id" | "name" | "role">;
  reviewedAt?: string;
  createdAt: string;
}

export interface Ride {
  _id: string;
  driver: User;
  fromCity: string;
  toCity: string;
  date: string;
  time: string;
  dateTime?: string;
  startTime?: string;
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
  userId?: string;
  type: "message" | "ride_request" | "payment_update" | "ride_posted" | "ride_booked" | "generic";
  title: string;
  body: string;
  isRead: boolean;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface NotificationSettings {
  messages: boolean;
  rides: boolean;
  payments: boolean;
}

export interface BlockedUser {
  _id: string;
  name: string;
  role: "admin" | "passenger" | "driver";
  profilePhoto?: string;
  isVerified?: boolean;
}

export interface SupportRequest {
  _id: string;
  userId: string;
  message: string;
  status: "open" | "closed";
  createdAt: string;
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
  ongoingRides: Ride[];
  scheduledRides: Ride[];
  liveRides: Ride[];
  upcomingRides: Ride[];
  rides: Ride[];
}

export interface MyRidesResponse {
  ongoingRides: Ride[];
  scheduledRides: Ride[];
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
