const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s]{7,20}$/;
const EXPO_PUSH_PATTERN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]+\]$/;
const APP_STATUSES = ["Pending", "Applied", "Rejected", "Approved"];

export function sanitizeString(value, maxLength = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(value) {
  return sanitizeString(value, 320).toLowerCase();
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function isValidPhone(value) {
  if (!value) {
    return true;
  }

  return PHONE_PATTERN.test(sanitizeString(value, 20));
}

export function isValidDateInput(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function isValidExpoPushToken(value) {
  return EXPO_PUSH_PATTERN.test(sanitizeString(value, 200));
}

export function validateApplicationPayload(body, { partial = false } = {}) {
  const payload = {
    title: sanitizeString(body.title, 120),
    portalName: sanitizeString(body.portalName, 120),
    deadline: body.deadline,
    status: sanitizeString(body.status || "Pending", 20) || "Pending",
    notes: sanitizeString(body.notes, 2000),
    alertEnabled: typeof body.alertEnabled === "boolean" ? body.alertEnabled : true
  };

  const errors = [];

  if (!partial || body.title !== undefined) {
    if (!payload.title) {
      errors.push("Title is required");
    }
  }

  if (!partial || body.portalName !== undefined) {
    if (!payload.portalName) {
      errors.push("Portal name is required");
    }
  }

  if (!partial || body.deadline !== undefined) {
    if (!isValidDateInput(payload.deadline)) {
      errors.push("A valid deadline is required");
    }
  }

  if (payload.status && !APP_STATUSES.includes(payload.status)) {
    errors.push("Status must be Pending, Applied, Approved, or Rejected");
  }

  return { payload, errors };
}

export function validateProfilePayload(body) {
  const payload = {
    fullName: sanitizeString(body.fullName, 120),
    email: normalizeEmail(body.email),
    phone: sanitizeString(body.phone, 20),
    dob: sanitizeString(body.dob, 30),
    qualification: sanitizeString(body.qualification, 120),
    institution: sanitizeString(body.institution, 160),
    course: sanitizeString(body.course, 120),
    graduationYear: sanitizeString(body.graduationYear, 10),
    targetRole: sanitizeString(body.targetRole, 120),
    address: sanitizeString(body.address, 500),
    city: sanitizeString(body.city, 80),
    state: sanitizeString(body.state, 80),
    pincode: sanitizeString(body.pincode, 20)
  };

  const preferences = {
    emailReminders:
      typeof body.notificationPreferences?.emailReminders === "boolean"
        ? body.notificationPreferences.emailReminders
        : true,
    pushReminders:
      typeof body.notificationPreferences?.pushReminders === "boolean"
        ? body.notificationPreferences.pushReminders
        : true
  };

  const errors = [];

  if (!payload.fullName) {
    errors.push("Full name is required");
  }

  if (!payload.email || !isValidEmail(payload.email)) {
    errors.push("A valid email is required");
  }

  if (!isValidPhone(payload.phone)) {
    errors.push("Phone number format is invalid");
  }

  return { payload, preferences, errors };
}
