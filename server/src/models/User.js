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
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    cnicNumber: {
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
    licensePhoto: {
      type: String,
      trim: true,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
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
    this.canPostRide = true;
    this.canBookRide = true;
    this.canChat = true;
    this.accountStatus = "active";
    this.isVerified = true;
    this.verificationStatus = "approved";
  }

  return next();
});

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $ne: "" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: "" } } });

export const User = mongoose.model("User", userSchema);
