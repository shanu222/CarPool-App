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
      enum: ["passenger", "driver"],
      default: "passenger",
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

  return next();
});

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true, $ne: "" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: "" } } });

export const User = mongoose.model("User", userSchema);
