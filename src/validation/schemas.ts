import { z } from "zod";

// Payloads are rich and computed client-side, so schemas validate the
// load-bearing fields and pass the rest through unchanged.

export const loginSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
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
