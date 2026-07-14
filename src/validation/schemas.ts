import { z } from "zod";

// Payloads are rich and computed client-side, so schemas validate the
// load-bearing fields and pass the rest through unchanged.

// Email + password login (credentials owned by our backend/MongoDB).
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const phoneField = z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number");
const otpField = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
// Password must be 8+ chars with lowercase, uppercase and a number.
const passwordField = z
  .string()
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
    "Password must be 8+ characters with upper, lower and a number"
  );

// Request an email verification code (signup / password reset).
export const sendOtpSchema = z.object({ email: z.string().email("Enter a valid email") });

// Signup: account is created only after the email OTP is verified server-side.
// Phone is collected and stored, but not OTP-verified.
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: passwordField,
  phone: phoneField,
  otp: otpField,
});

// Forgot password: prove ownership by verifying the account's email via OTP,
// then set a new password.
export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
  otp: otpField,
  newPassword: passwordField,
});

export const categorySchema = z
  .object({ name: z.string().min(1, "Category name is required") })
  .passthrough();

export const partyCreateSchema = z
  .object({
    partyName: z.string().min(1, "Party name is required"),
    partyType: z.enum(["CUSTOMER", "SUPPLIER"]).optional(),
  })
  .passthrough();

export const partyUpdateSchema = z.object({}).passthrough();

export const updateStockSchema = z
  .object({
    id: z.string().min(1, "id is required"),
    stock: z.number().optional(),
    adjustment: z.number().optional(),
  })
  .passthrough();

const invoiceItemRow = z
  .object({
    itemId: z.string().optional(),
    quantity: z.number().optional(),
  })
  .passthrough();

export const saleCreateSchema = z
  .object({
    partyId: z.string().min(1, "partyId is required"),
    invioceNo: z.string().min(1, "Invoice number is required"),
    itemDetails: z.array(invoiceItemRow).min(1, "At least one item is required"),
  })
  .passthrough();

export const purchaseCreateSchema = saleCreateSchema;

export const demoBookSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    mobileNo: z.string().min(1, "Mobile number is required"),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    businessName: z.string().optional(),
    interest: z.enum(["BILLING", "INVENTORY", "GST", "REPORTS", "OTHER"]).optional(),
    preferredDate: z.string().optional(),
    preferredTime: z.string().optional(),
    attendees: z.number().int().positive().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const demoStatusSchema = z.object({
  status: z.enum(["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"]),
});
