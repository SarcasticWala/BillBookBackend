import { z } from "zod";

// Payloads are rich and computed client-side, so schemas validate the
// load-bearing fields and pass the rest through unchanged.

// Email + password login (credentials owned by our backend/MongoDB).
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const phoneField = z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number");
const otpField = z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP");

// Request an OTP for a phone number (signup / password reset).
export const sendOtpSchema = z.object({ phone: phoneField });

// Signup: account is created only after the phone OTP is verified server-side.
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  phone: phoneField,
  otp: otpField,
});

// Forgot password: prove ownership by verifying the account's phone via OTP,
// then set a new password.
export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
  phone: phoneField,
  otp: otpField,
  newPassword: z.string().min(8, "Use at least 8 characters"),
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
