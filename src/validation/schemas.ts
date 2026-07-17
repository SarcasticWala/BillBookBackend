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

export const verifyOtpSchema = z.object({
  email: z.string().email("Enter a valid email"),
  otp: otpField,
});

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

// ---- Cash & Bank (accounts) ----

// IFSC is optional, but when present it must match the RBI format:
// 4 letters (bank code) + 0 + 6 alphanumerics = 11 chars (e.g. HDFC0001234).
const ifscField = z
  .string()
  .regex(
    /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/,
    "Enter a valid IFSC code, e.g. HDFC0001234 (4 letters, 0, then 6 characters)"
  )
  .or(z.literal(""))
  .optional();

// Indian bank account numbers are 9–18 digits. Optional (empty allowed).
const accountNumberField = z
  .string()
  .regex(/^(\d{9,18})?$/, "Account number must be 9 to 18 digits")
  .optional();

export const accountCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Account name is required")
      .max(60, "Account name is too long"),
    type: z.enum(["CASH", "BANK"]).optional(),
    openingBalance: z.coerce.number()
      .finite("Opening balance must be a number")
      .optional(),
    bankName: z.string().max(80).optional(),
    accountNumber: accountNumberField,
    ifsc: ifscField,
    upiId: z.string().max(60).optional(),
  })
  .passthrough();

export const moneyAdjustSchema = z
  .object({
    type: z.enum(["IN", "OUT"]).optional(),
    amount: z.coerce.number()
      .positive("Amount must be greater than zero"),
    description: z.string().max(200).optional(),
    date: z.string().optional(),
  })
  .passthrough();

export const expenseCreateSchema = z
  .object({
    expenseNumber: z.string().trim().min(1, "Expense number is required"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    expenseDate: z.string().optional(),
    category: z.string().max(80).optional(),
    partyName: z.string().max(120).optional(),
    paymentMode: z.string().max(20).optional(),
    notes: z.string().max(500).optional(),
  })
  .passthrough();

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Source account is required"),
    toAccountId: z.string().min(1, "Destination account is required"),
    amount: z.coerce.number()
      .positive("Amount must be greater than zero"),
    description: z.string().max(200).optional(),
    date: z.string().optional(),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "Source and destination must be different accounts",
    path: ["toAccountId"],
  });
