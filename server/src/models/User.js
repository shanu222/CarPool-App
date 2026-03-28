import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "passenger", "driver"],
      default: "passenger",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "suspended", "banned"],
      default: "pending",
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
      index: true,
    },
    suspensionReason: {
      type: String,
      trim: true,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },
    fcmToken: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    verified: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    cnicNumber: {
      type: String,
      trim: true,
    },
    dob: {
      type: String,
      trim: true,
    },
    cnicFrontImage: {
      type: String,
      trim: true,
    },
    cnicBackImage: {
      type: String,
      trim: true,
    },
    selfieImage: {
      type: String,
      trim: true,
    },
    cnicPhoto: {
      type: String,
      trim: true,
    },
    cnic: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
      trim: true,
    },
    carPhoto: {
      type: String,
      trim: true,
    },
    carMake: {
      type: String,
      trim: true,
    },
    carModel: {
      type: String,
      trim: true,
    },
    carColor: {
      type: String,
      trim: true,
    },
    carPlateNumber: {
      type: String,
      trim: true,
    },
    carYear: {
      type: Number,
      min: 1970,
      max: 2100,
    },
    licensePhoto: {
      type: String,
      trim: true,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokenBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeRequests: {
      type: Number,
      default: 5,
      min: 0,
    },
    freePosts: {
      type: Number,
      default: 5,
      min: 0,
    },
    freeChats: {
      type: Number,
      default: 5,
      min: 0,
    },
    freeRideCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    freePostsRemaining: {
      type: Number,
      default: 5,
      min: 0,
    },
    freeChatCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeChatsRemaining: {
      type: Number,
      default: 5,
      min: 0,
    },
    freeRequestsRemaining: {
      type: Number,
      default: 5,
      min: 0,
    },
    hasPurchased: {
      type: Boolean,
      default: false,
      index: true,
    },
    canPostRide: {
      type: Boolean,
      default: false,
    },
    canBookRide: {
      type: Boolean,
      default: false,
    },
    canChat: {
      type: Boolean,
      default: false,
    },
    paymentApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    notificationSettings: {
      messages: {
        type: Boolean,
        default: true,
      },
      rides: {
        type: Boolean,
        default: true,
      },
      payments: {
        type: Boolean,
        default: true,
      },
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    resetToken: {
      type: String,
      select: false,
    },
    resetTokenExpiry: {
      type: Date,
      select: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    otpResendAvailableAt: {
      type: Date,
      select: false,
    },
    resetSessionToken: {
      type: String,
      select: false,
    },
    resetSessionExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", function syncLegacyVerificationFields(next) {
  if (this.cnicNumber && !this.cnic) {
    this.cnic = this.cnicNumber;
  }

  if (this.cnic && !this.cnicNumber) {
    this.cnicNumber = this.cnic;
  }

  if (this.cnicPhoto && !this.licensePhoto) {
    this.licensePhoto = this.cnicPhoto;
  }

  if (this.licensePhoto && !this.cnicPhoto) {
    this.cnicPhoto = this.licensePhoto;
  }

  if (this.role === "admin") {
    this.status = "approved";
    this.isBlocked = false;
    this.canPostRide = true;
    this.canBookRide = true;
    this.canChat = true;
    this.paymentApproved = true;
    this.accountStatus = "active";
    this.isVerified = true;
    this.verified = true;
    this.verificationStatus = "verified";
    this.isDeleted = false;
    this.hasPurchased = true;
  }

  // Keep legacy and strict token field names synchronized.
  if (typeof this.tokens === "number") {
    this.tokenBalance = this.tokens;
  } else if (typeof this.tokenBalance === "number") {
    this.tokens = this.tokenBalance;
  }

  if (typeof this.freePostsRemaining === "number") {
    this.freeRideCredits = this.freePostsRemaining;
  } else if (typeof this.freeRideCredits === "number") {
    this.freePostsRemaining = this.freeRideCredits;
  }

  if (typeof this.freePosts === "number") {
    this.freePostsRemaining = this.freePosts;
  } else if (typeof this.freePostsRemaining === "number") {
    this.freePosts = this.freePostsRemaining;
  }

  if (typeof this.freeChatsRemaining === "number") {
    this.freeChatCredits = this.freeChatsRemaining;
  } else if (typeof this.freeChatCredits === "number") {
    this.freeChatsRemaining = this.freeChatCredits;
  }

  if (typeof this.freeChats === "number") {
    this.freeChatsRemaining = this.freeChats;
  } else if (typeof this.freeChatsRemaining === "number") {
    this.freeChats = this.freeChatsRemaining;
  }

  if (typeof this.freeRequests === "number") {
    this.freeRequestsRemaining = this.freeRequests;
  } else if (typeof this.freeRequestsRemaining === "number") {
    this.freeRequests = this.freeRequestsRemaining;
  }

  if (typeof this.isVerified === "boolean" && typeof this.verified !== "boolean") {
    this.verified = this.isVerified;
  }

  if (typeof this.verified === "boolean") {
    this.isVerified = this.verified;
  }

  return next();
});

userSchema.index(
  { email: 1, role: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true, $ne: "" } } }
);
userSchema.index(
  { phone: 1, role: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: "" } } }
);
userSchema.index(
  { cnicNumber: 1 },
  { unique: true, partialFilterExpression: { cnicNumber: { $exists: true, $ne: "" } } }
);

export const User = mongoose.model("User", userSchema);
