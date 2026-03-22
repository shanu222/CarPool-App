import { ChangeRequest } from "../models/ChangeRequest.js";
import { User } from "../models/User.js";

const sanitizeRequestedData = (type, input = {}) => {
  if (type === "cnic_update") {
    const cnicNumber = String(input.cnicNumber || input.cnic || "").trim();
    return { cnicNumber };
  }

  return {
    carMake: String(input.carMake || "").trim(),
    carModel: String(input.carModel || "").trim(),
    carColor: String(input.carColor || "").trim(),
    carPlateNumber: String(input.carPlateNumber || "").trim(),
    carYear: input.carYear ? Number(input.carYear) : undefined,
  };
};

export const submitChangeRequest = async (req, res, next) => {
  try {
    const { type, requestedData, reason } = req.body;

    if (!type || !["cnic_update", "car_update"].includes(type)) {
      return res.status(400).json({ message: "type must be cnic_update or car_update" });
    }

    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) {
      return res.status(400).json({ message: "Please provide reason for change" });
    }

    const payload = sanitizeRequestedData(type, requestedData || {});

    if (type === "cnic_update" && !payload.cnicNumber) {
      return res.status(400).json({ message: "New CNIC is required" });
    }

    if (type === "car_update" && (!payload.carMake || !payload.carModel || !payload.carPlateNumber)) {
      return res.status(400).json({ message: "carMake, carModel and carPlateNumber are required" });
    }

    const currentData =
      type === "cnic_update"
        ? {
            cnicNumber: req.user.cnicNumber || req.user.cnic || "",
          }
        : {
            carMake: req.user.carMake || "",
            carModel: req.user.carModel || "",
            carColor: req.user.carColor || "",
            carPlateNumber: req.user.carPlateNumber || "",
            carYear: req.user.carYear || undefined,
          };

    const request = await ChangeRequest.create({
      userId: req.user._id,
      type,
      currentData,
      requestedData: payload,
      reason: normalizedReason,
      status: "pending",
    });

    return res.status(201).json(request);
  } catch (error) {
    return next(error);
  }
};

export const getMyChangeRequests = async (req, res, next) => {
  try {
    const items = await ChangeRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    return next(error);
  }
};

export const getAdminChangeRequests = async (_req, res, next) => {
  try {
    const items = await ChangeRequest.find({})
      .populate("userId", "name role isVerified")
      .populate("reviewedBy", "name role")
      .sort({ createdAt: -1 });

    return res.json(items);
  } catch (error) {
    return next(error);
  }
};

export const reviewChangeRequest = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be approved or rejected" });
    }

    const request = await ChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Change request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be reviewed" });
    }

    if (status === "approved") {
      const user = await User.findById(request.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (request.type === "cnic_update") {
        const nextCnic = String(request.requestedData?.cnicNumber || "").trim();
        if (nextCnic) {
          user.cnicNumber = nextCnic;
          user.cnic = nextCnic;
        }
      }

      if (request.type === "car_update") {
        user.carMake = String(request.requestedData?.carMake || "").trim();
        user.carModel = String(request.requestedData?.carModel || "").trim();
        user.carColor = String(request.requestedData?.carColor || "").trim();
        user.carPlateNumber = String(request.requestedData?.carPlateNumber || "").trim();
        if (request.requestedData?.carYear) {
          user.carYear = Number(request.requestedData.carYear);
        }
      }

      await user.save();
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await ChangeRequest.findById(request._id)
      .populate("userId", "name role isVerified")
      .populate("reviewedBy", "name role");

    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};
