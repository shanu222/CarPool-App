import { compareFaces } from "./faceService.js";
import { extractCnicData, extractLicenseData } from "./ocrService.js";
import { isNameMatch, isSameDate, normalizeCnic, normalizeDob, normalizeName } from "../utils/kycUtils.js";

const normalizeLicense = (value) => String(value || "").replace(/[^0-9]/g, "");

export const toDateOrNull = (value) => {
  const normalized = normalizeDob(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isDateExpired = (dateValue) => {
  if (!dateValue) {
    return false;
  }

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
};

export const buildVerificationMeta = ({ isVerified, isCnicExpired, isLicenseExpired, role }) => {
  let statusLabel = "Verified";

  if (!isVerified) {
    statusLabel = "Not Verified";
  } else if (isCnicExpired) {
    statusLabel = "CNIC Expired";
  } else if (role === "driver" && isLicenseExpired) {
    statusLabel = "License Expired";
  }

  return {
    isVerified: Boolean(isVerified),
    isCnicExpired: Boolean(isCnicExpired),
    isLicenseExpired: Boolean(isLicenseExpired),
    statusLabel,
    visibility: isVerified ? "normal" : "low",
  };
};

export const verifyIdentityDocuments = async ({
  name,
  dob,
  cnic,
  role,
  licenseNumber,
  cnicFrontPath,
  cnicBackPath,
  profileImagePath,
  licenseImagePath,
  faceThreshold = Number(process.env.FACE_MATCH_THRESHOLD || 80),
  enforceLicenseCheck = false,
}) => {
  const normalizedCnic = normalizeCnic(cnic);
  const normalizedDob = normalizeDob(dob);

  if (!normalizedCnic) {
    return {
      ok: false,
      reason: "CNIC_FORMAT_INVALID",
      details: {
        failedField: "cnic",
        why: "CNIC format is invalid",
        hint: "Use XXXXX-XXXXXXX-X format (13 digits with optional dashes).",
        inputValue: String(cnic || ""),
      },
    };
  }

  if (!normalizedDob) {
    return {
      ok: false,
      reason: "DOB_FORMAT_INVALID",
      details: {
        failedField: "dob",
        why: "Date format is invalid",
        hint: "Use a valid date that matches CNIC Date of Birth.",
        inputValue: String(dob || ""),
      },
    };
  }

  let cnicData;
  try {
    cnicData = await extractCnicData({
      cnicFrontPath,
      cnicBackPath,
    });
  } catch {
    return {
      ok: false,
      reason: "OCR_EXTRACTION_FAILED",
      details: {
        failedField: "cnic_images",
        why: "OCR could not read CNIC clearly",
        hint: "Use a sharp image, avoid blur/glare, keep full card visible, and ensure text is readable.",
      },
    };
  }

  if (!cnicData?.cnic || normalizeCnic(cnicData.cnic) !== normalizedCnic) {
    return {
      ok: false,
      reason: "CNIC_MISMATCH",
      details: {
        failedField: "cnic",
        why: "CNIC number does not match",
        hint: "Check digits and dashes exactly as printed on CNIC.",
        inputValue: normalizedCnic,
        extractedCnic: cnicData?.cnic || "",
      },
    };
  }

  const normalizedInputName = normalizeName(name);
  const extractedNameCandidates = [cnicData?.name, ...(cnicData?.nameCandidates || [])]
    .map((value) => normalizeName(value))
    .filter(Boolean);

  if (!extractedNameCandidates.length) {
    return {
      ok: false,
      reason: "NAME_EXTRACTION_FAILED",
      details: {
        failedField: "name",
        why: "OCR could not confidently extract Name from CNIC front image",
        hint: "Retake CNIC front in bright light and keep the Name area clear and sharp.",
      },
    };
  }

  const nameMatched = extractedNameCandidates.some((candidate) => isNameMatch(normalizedInputName, candidate));

  if (!nameMatched) {
    return {
      ok: false,
      reason: "NAME_MISMATCH",
      details: {
        failedField: "name",
        why: "Name does not match",
        hint: "Enter name exactly as printed under the Name label on CNIC.",
        inputValue: String(name || "").trim(),
        extractedName: cnicData?.name || "",
        extractedNameCandidates,
      },
    };
  }

  if (!cnicData?.dob || !isSameDate(normalizedDob, cnicData.dob)) {
    return {
      ok: false,
      reason: "DOB_MISMATCH",
      details: {
        failedField: "dob",
        why: "Date of Birth does not match",
        hint: "Match CNIC Date of Birth exactly (day/month/year).",
        inputValue: normalizedDob,
        extractedDob: cnicData?.dob || "",
      },
    };
  }

  let licenseData = null;

  if (enforceLicenseCheck && role === "driver") {
    if (!licenseNumber || !licenseImagePath) {
      return {
        ok: false,
        reason: "LICENSE_REQUIRED",
        details: {
          failedField: "licenseImage",
          why: "License number and image are required",
          hint: "Upload license image and enter license number.",
        },
      };
    }

    try {
      licenseData = await extractLicenseData(licenseImagePath);
    } catch (error) {
      return {
        ok: false,
        reason: "LICENSE_EXTRACTION_FAILED",
        details: {
          failedField: "licenseImage",
          why: "License OCR failed",
          hint: "Upload a clearer license image with visible number and no glare/blur.",
          errorMessage: error?.message,
        },
      };
    }

    const inputLicense = normalizeLicense(licenseNumber);
    const extractedLicense = normalizeLicense(licenseData?.licenseNumber);

    console.log("INPUT:", inputLicense);
    console.log("OCR:", extractedLicense);

    if (!extractedLicense || inputLicense !== extractedLicense) {
      return {
        ok: false,
        reason: "LICENSE_MISMATCH",
        details: {
          failedField: "licenseNumber",
          why: "License number does not match",
          hint: "Enter the same license number shown on uploaded driving license image.",
          inputValue: inputLicense,
          extractedLicense,
        },
      };
    }
  }

  let faceResult = {
    matched: true,
    similarity: 0,
    threshold: Number(faceThreshold),
    source: "skipped",
    skipped: true,
  };

  if (profileImagePath) {
    try {
      faceResult = await compareFaces(cnicFrontPath, profileImagePath, Number(faceThreshold));
    } catch {
      return {
        ok: false,
        reason: "FACE_CHECK_FAILED",
        details: {
          failedField: "profileImage",
          why: "Face comparison could not run",
          hint: "Use a clear front-facing selfie and ensure CNIC face is fully visible.",
        },
      };
    }

    if (!faceResult?.matched) {
      return {
        ok: false,
        reason: "FACE_MISMATCH",
        details: {
          failedField: "face",
          why: "Face does not match CNIC photo",
          hint: "Retake selfie in good light, without blur, sunglasses, or heavy angle.",
          similarity: Number(faceResult?.similarity || 0),
          threshold: Number(faceThreshold),
          source: faceResult?.source || "aws",
          openAiConfidence: Number(faceResult?.openAiConfidence || 0),
          openAiReason: faceResult?.openAiReason || "",
        },
      };
    }
  }

  const cnicExpiryDate = toDateOrNull(cnicData?.cnicExpiry);
  const licenseExpiryDate = toDateOrNull(licenseData?.licenseExpiry);
  const isCnicExpired = isDateExpired(cnicExpiryDate);
  const isLicenseExpired = role === "driver" ? isDateExpired(licenseExpiryDate) : false;

  return {
    ok: true,
    normalizedCnic,
    normalizedDob,
    cnicData,
    licenseData,
    cnicExpiryDate,
    licenseExpiryDate,
    isCnicExpired,
    isLicenseExpired,
    faceResult,
  };
};
