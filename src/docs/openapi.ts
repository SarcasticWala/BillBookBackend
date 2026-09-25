import { z, ZodTypeAny } from "zod";
import {
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  resetPasswordSchema,
  categorySchema,
  partyCreateSchema,
  partyUpdateSchema,
  updateStockSchema,
  saleCreateSchema,
  purchaseCreateSchema,
  demoBookSchema,
  demoStatusSchema,
  accountCreateSchema,
  moneyAdjustSchema,
  transferSchema,
  expenseCreateSchema,
} from "../validation/schemas";

/**
 * OpenAPI 3.0 document for the BillBook API.
 *
 * Request-body component schemas are generated DIRECTLY from the Zod schemas in
 * `validation/schemas.ts` via Zod v4's native `z.toJSONSchema`, so the docs
 * never drift from the actual validation rules. Response envelopes and paths are
 * authored from the real route files (`routes/*.routes.ts`).
 */

// Convert a Zod schema to an OpenAPI-3.0 schema object. `io: "input"` describes
// the shape the client SENDS (before coercion/defaults are applied).
function fromZod(schema: ZodTypeAny): Record<string, unknown> {
  const out = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
    // `.passthrough()`/unrepresentable pieces shouldn't blow up doc generation.
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete (out as any).$schema;
  return out;
}

const bearerAuth = [{ bearerAuth: [] as string[] }];

// ---- Reusable response helpers -------------------------------------------

const jsonRef = (ref: string) => ({
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const successRes = (description = "Success") => ({
  description,
  ...jsonRef("SuccessResponse"),
});

const listRes = (description = "Success") => ({
  description,
  ...jsonRef("ListResponse"),
});

const authRes = (description = "Authenticated — returns a JWT and the user") => ({
  description,
  ...jsonRef("AuthResponse"),
});

const err = (description: string) => ({ description, ...jsonRef("ErrorResponse") });

const E_400 = { "400": err("Validation failed — see `details[]`") };
const E_401 = { "401": err("Authentication required / invalid or expired token") };
const E_403 = { "403": err("Admin access required") };
const E_404 = { "404": err("Resource not found") };
const E_409 = { "409": err("Duplicate value, or an in-flight idempotent request") };
const E_500 = { "500": err("Internal server error") };

// ---- Reusable parameters --------------------------------------------------

const pageParam = {
  name: "page",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 1, default: 1 },
  description: "1-based page number (paged endpoints).",
};
const limitParam = {
  name: "limit",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 1, maximum: 500, default: 200 },
  description: "Page size, capped at 500.",
};
const idPath = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "MongoDB ObjectId of the resource.",
};
const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  schema: { type: "string" },
  description:
    "Optional. If supplied, a successful create is stored and replayed for retries with the same key (create endpoints only).",
};

const jsonBody = (ref: string, required = true) => ({
  required,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

// A multipart body: a set of scalar fields plus one or more binary file fields.
const multipartBody = (
  properties: Record<string, unknown>,
  required: string[] = []
) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: { type: "object", properties, ...(required.length ? { required } : {}) },
    },
  },
});

// ---- Component schemas ----------------------------------------------------

const schemas: Record<string, unknown> = {
  // Generated from Zod — request bodies.
  LoginRequest: fromZod(loginSchema),
  SendOtpRequest: fromZod(sendOtpSchema),
  VerifyOtpRequest: fromZod(verifyOtpSchema),
  RegisterRequest: fromZod(registerSchema),
  ResetPasswordRequest: fromZod(resetPasswordSchema),
  CategoryRequest: fromZod(categorySchema),
  PartyCreateRequest: fromZod(partyCreateSchema),
  PartyUpdateRequest: fromZod(partyUpdateSchema),
  UpdateStockRequest: fromZod(updateStockSchema),
  SaleCreateRequest: fromZod(saleCreateSchema),
  PurchaseCreateRequest: fromZod(purchaseCreateSchema),
  DemoBookRequest: fromZod(demoBookSchema),
  DemoStatusRequest: fromZod(demoStatusSchema),
  AccountCreateRequest: fromZod(accountCreateSchema),
  MoneyAdjustRequest: fromZod(moneyAdjustSchema),
  TransferRequest: fromZod(transferSchema),
  ExpenseCreateRequest: fromZod(expenseCreateSchema),

  // Hand-authored — response envelopes (see utils/respond.ts & middleware/error.ts).
  SuccessResponse: {
    type: "object",
    description: "Standard success envelope.",
    properties: {
      data: { description: "The resource or result (shape varies by endpoint)." },
      message: { type: "string" },
    },
  },
  ListResponse: {
    type: "object",
    description:
      "List envelope. `data` is an array; paged endpoints may also include paging metadata.",
    properties: {
      data: { type: "array", items: {} },
      message: { type: "string" },
    },
  },
  AuthResponse: {
    type: "object",
    description: "Returned by login / register / reset-password.",
    properties: {
      token: { type: "string", description: "JWT bearer token (expires per JWT_EXPIRES_IN)." },
      data: { $ref: "#/components/schemas/User" },
    },
    required: ["token", "data"],
  },
  SendOtpResponse: {
    type: "object",
    properties: {
      message: { type: "string", example: "Verification code sent" },
      devCode: {
        type: "string",
        description:
          "Only present in non-production when no email provider is configured, so the flow stays testable.",
      },
    },
    required: ["message"],
  },
  MessageResponse: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  },
  User: {
    type: "object",
    description: "Public user profile (password fields are never returned).",
    properties: {
      _id: { type: "string" },
      name: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string", description: "E.164, e.g. +919800054895." },
      emailVerified: { type: "boolean" },
      businessName: { type: "string" },
      hasLogo: {
        type: "boolean",
        description:
          "Whether a business logo is on file. The image itself is NOT returned here — it is a multi-megabyte data URI and this schema is served on every page load. Fetch it from GET /auth/logo.",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    additionalProperties: true,
  },
  ErrorResponse: {
    type: "object",
    description: "Standard error envelope from the global error handler.",
    properties: {
      message: { type: "string" },
      details: {
        description:
          "Optional. For validation errors, an array of { path, message }; for duplicates, the offending key/value.",
      },
    },
    required: ["message"],
  },
};

// ---- Paths ----------------------------------------------------------------

const paths: Record<string, unknown> = {
  // ============================ AUTH ============================
  "/api/auth/send-otp": {
    post: {
      tags: ["Auth"],
      summary: "Request an email verification code (signup / reset)",
      description: "Rate-limited. Sends a 6-digit code that expires in 5 minutes.",
      requestBody: jsonBody("SendOtpRequest"),
      responses: {
        "200": { description: "Code sent", ...jsonRef("SendOtpResponse") },
        ...E_400,
        "429": err("Too many requests — resend cooldown / rate limit"),
        ...E_500,
      },
    },
  },
  "/api/auth/verify-otp": {
    post: {
      tags: ["Auth"],
      summary: "Verify an email code without consuming it (reset flow step)",
      requestBody: jsonBody("VerifyOtpRequest"),
      responses: {
        "200": { description: "Code verified", ...jsonRef("SuccessResponse") },
        ...E_400,
        "429": err("Too many attempts / rate limit"),
        ...E_500,
      },
    },
  },
  "/api/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Create an account (email OTP verified server-side first)",
      requestBody: jsonBody("RegisterRequest"),
      responses: { "201": authRes("Account created"), ...E_400, ...E_409, ...E_500 },
    },
  },
  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Email + password login",
      requestBody: jsonBody("LoginRequest"),
      responses: {
        "200": authRes(),
        ...E_400,
        "401": err("Invalid credentials"),
        ...E_500,
      },
    },
  },
  "/api/auth/reset-password": {
    post: {
      tags: ["Auth"],
      summary: "Reset password after verifying the account's email via OTP",
      requestBody: jsonBody("ResetPasswordRequest"),
      responses: { "200": authRes(), ...E_400, ...E_500 },
    },
  },
  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Current user's profile",
      security: bearerAuth,
      responses: { "200": successRes("The authenticated user"), ...E_401, ...E_500 },
    },
  },
  "/api/auth/profile": {
    put: {
      tags: ["Auth"],
      summary: "Update profile (optional business logo upload)",
      security: bearerAuth,
      requestBody: multipartBody({
        name: { type: "string" },
        businessName: { type: "string" },
        phone: { type: "string" },
        logo: { type: "string", format: "binary", description: "≤ 2MB image, stored inline." },
      }),
      responses: { "200": successRes("Updated user"), ...E_400, ...E_401, ...E_500 },
    },
  },

  // ============================ ITEM ============================
  "/api/item/create": {
    post: {
      tags: ["Item"],
      summary: "Create an item (up to 5 images)",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: multipartBody({
        itemImages: {
          type: "array",
          items: { type: "string", format: "binary" },
          description: "Up to 5 image files.",
        },
      }),
      responses: { "201": successRes("Item created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/item/bulk-create-items": {
    post: {
      tags: ["Item"],
      summary: "Bulk-create items from an Excel file",
      description:
        "On validation failure, responds 400 with an .xlsx error workbook (binary) instead of JSON.",
      security: bearerAuth,
      requestBody: multipartBody(
        { file: { type: "string", format: "binary", description: "Excel (.xlsx) file." } },
        ["file"]
      ),
      responses: {
        "201": successRes("Items created — `{ data: { count } }`"),
        "400": {
          description: "Validation errors returned as a downloadable .xlsx workbook",
          content: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        ...E_401,
        ...E_500,
      },
    },
  },
  "/api/item/items": {
    get: {
      tags: ["Item"],
      summary: "List items (non-paginated, capped)",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/item/items-paged": {
    get: {
      tags: ["Item"],
      summary: "List items (paged)",
      security: bearerAuth,
      parameters: [pageParam, limitParam],
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/item/get-item": {
    get: {
      tags: ["Item"],
      summary: "Get one item by id",
      security: bearerAuth,
      parameters: [
        { name: "id", in: "query", required: true, schema: { type: "string" } },
      ],
      responses: { "200": successRes(), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/item/create-item-category": {
    post: {
      tags: ["Item"],
      summary: "Create an item category",
      security: bearerAuth,
      requestBody: jsonBody("CategoryRequest"),
      responses: { "201": successRes("Category created"), ...E_400, ...E_401, ...E_500 },
    },
  },
  "/api/item/get-item-catagories": {
    get: {
      tags: ["Item"],
      summary: "List item categories",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/item/taxes": {
    get: {
      tags: ["Item"],
      summary: "List tax reference data",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/item/units": {
    get: {
      tags: ["Item"],
      summary: "List unit reference data",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/item/update-item-stock": {
    put: {
      tags: ["Item"],
      summary: "Set or adjust an item's stock",
      security: bearerAuth,
      requestBody: jsonBody("UpdateStockRequest"),
      responses: { "200": successRes("Stock updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/item/update/{id}": {
    put: {
      tags: ["Item"],
      summary: "Update an item (up to 5 new images; existing kept)",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: multipartBody({
        itemImages: { type: "array", items: { type: "string", format: "binary" } },
      }),
      responses: { "200": successRes("Item updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },

  // ============================ PARTY ============================
  "/api/party/create": {
    post: {
      tags: ["Party"],
      summary: "Create a party (customer/supplier)",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("PartyCreateRequest"),
      responses: { "201": successRes("Party created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/party/parties": {
    get: {
      tags: ["Party"],
      summary: "List parties (non-paginated, capped)",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/party/parties-paged": {
    get: {
      tags: ["Party"],
      summary: "List parties (paged)",
      security: bearerAuth,
      parameters: [pageParam, limitParam],
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/party/get-party/{id}": {
    get: {
      tags: ["Party"],
      summary: "Get one party by id",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes(), ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/party/update-party/{id}": {
    put: {
      tags: ["Party"],
      summary: "Update a party",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("PartyUpdateRequest"),
      responses: { "200": successRes("Party updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/party/create-category": {
    post: {
      tags: ["Party"],
      summary: "Create a party category",
      security: bearerAuth,
      requestBody: jsonBody("CategoryRequest"),
      responses: { "201": successRes("Category created"), ...E_400, ...E_401, ...E_500 },
    },
  },
  "/api/party/get-catagories": {
    get: {
      tags: ["Party"],
      summary: "List party categories",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/party/locations": {
    get: {
      tags: ["Party"],
      summary: "List location reference data",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/party/bulk-create": {
    post: {
      tags: ["Party"],
      summary: "Bulk-create parties from an Excel file",
      security: bearerAuth,
      requestBody: multipartBody(
        { file: { type: "string", format: "binary", description: "Excel (.xlsx) file." } },
        ["file"]
      ),
      responses: { "201": successRes("Parties created"), ...E_400, ...E_401, ...E_500 },
    },
  },

  // ============================ SALE ============================
  "/api/sale/create-sale": {
    post: {
      tags: ["Sale"],
      summary: "Create a sale invoice",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("SaleCreateRequest"),
      responses: { "201": successRes("Sale created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/sale/sale-invoices": {
    get: {
      tags: ["Sale"],
      summary: "List sale invoices (non-paginated, capped)",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/sale/sale-invoices-paged": {
    get: {
      tags: ["Sale"],
      summary: "List sale invoices (paged)",
      security: bearerAuth,
      parameters: [pageParam, limitParam],
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/sale/{id}": {
    get: {
      tags: ["Sale"],
      summary: "Get a sale invoice by id",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes(), ...E_401, ...E_404, ...E_500 },
    },
    put: {
      tags: ["Sale"],
      summary: "Update a sale invoice",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("SaleCreateRequest"),
      responses: { "200": successRes("Sale updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
    delete: {
      tags: ["Sale"],
      summary: "Delete a sale invoice",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes("Sale deleted"), ...E_401, ...E_404, ...E_500 },
    },
  },

  // ============================ PURCHASE ============================
  "/api/purchase/create-purchase": {
    post: {
      tags: ["Purchase"],
      summary: "Create a purchase invoice",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("PurchaseCreateRequest"),
      responses: { "201": successRes("Purchase created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/purchase/purchase-invoices": {
    get: {
      tags: ["Purchase"],
      summary: "List purchase invoices (non-paginated, capped)",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/purchase/purchase-invoices-paged": {
    get: {
      tags: ["Purchase"],
      summary: "List purchase invoices (paged)",
      security: bearerAuth,
      parameters: [pageParam, limitParam],
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/purchase/{id}": {
    get: {
      tags: ["Purchase"],
      summary: "Get a purchase invoice by id",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes(), ...E_401, ...E_404, ...E_500 },
    },
    put: {
      tags: ["Purchase"],
      summary: "Update a purchase invoice",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("PurchaseCreateRequest"),
      responses: { "200": successRes("Purchase updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
    delete: {
      tags: ["Purchase"],
      summary: "Delete a purchase invoice",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes("Purchase deleted"), ...E_401, ...E_404, ...E_500 },
    },
  },

  // ============================ DOCUMENT ============================
  "/api/document/create": {
    post: {
      tags: ["Document"],
      summary: "Create a document",
      description:
        "No server-side body schema — payload shape is client-defined (see note in the docs summary).",
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
      },
      responses: { "201": successRes("Document created"), ...E_401, ...E_500 },
    },
  },
  "/api/document/list": {
    get: {
      tags: ["Document"],
      summary: "List documents",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },

  // ============================ PAYMENT ============================
  "/api/payment/create": {
    post: {
      tags: ["Payment"],
      summary: "Record a payment",
      description: "No server-side body schema — payload shape is client-defined.",
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
      },
      responses: { "201": successRes("Payment created"), ...E_401, ...E_500 },
    },
  },
  "/api/payment/list": {
    get: {
      tags: ["Payment"],
      summary: "List payments",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },

  // ============================ DEMO ============================
  "/api/demo/book": {
    post: {
      tags: ["Demo"],
      summary: "Book a product demo",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("DemoBookRequest"),
      responses: { "201": successRes("Demo booked"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/demo/list": {
    get: {
      tags: ["Demo"],
      summary: "List the caller's demo requests",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/demo/admin/list": {
    get: {
      tags: ["Demo"],
      summary: "[Admin] List every demo request",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_403, ...E_500 },
    },
  },
  "/api/demo/admin/{id}/status": {
    patch: {
      tags: ["Demo"],
      summary: "[Admin] Update a demo request's status",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("DemoStatusRequest"),
      responses: { "200": successRes("Status updated"), ...E_400, ...E_401, ...E_403, ...E_404, ...E_500 },
    },
  },

  // ============================ ACCOUNT (Cash & Bank) ============================
  "/api/account/accounts": {
    get: {
      tags: ["Account"],
      summary: "List cash & bank accounts",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
    post: {
      tags: ["Account"],
      summary: "Create a cash/bank account",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("AccountCreateRequest"),
      responses: { "201": successRes("Account created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/account/accounts/{id}": {
    get: {
      tags: ["Account"],
      summary: "Get an account by id",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes(), ...E_401, ...E_404, ...E_500 },
    },
    put: {
      tags: ["Account"],
      summary: "Update an account",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("AccountCreateRequest"),
      responses: { "200": successRes("Account updated"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
    delete: {
      tags: ["Account"],
      summary: "Delete an account",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes("Account deleted"), ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/account/accounts/{id}/adjust": {
    post: {
      tags: ["Account"],
      summary: "Adjust money in/out of an account",
      security: bearerAuth,
      parameters: [idPath],
      requestBody: jsonBody("MoneyAdjustRequest"),
      responses: { "200": successRes("Balance adjusted"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/account/transfer": {
    post: {
      tags: ["Account"],
      summary: "Transfer money between two accounts",
      security: bearerAuth,
      requestBody: jsonBody("TransferRequest"),
      responses: { "200": successRes("Transfer complete"), ...E_400, ...E_401, ...E_404, ...E_500 },
    },
  },
  "/api/account/transactions": {
    get: {
      tags: ["Account"],
      summary: "List account transactions",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },

  // ============================ DASHBOARD ============================
  "/api/dashboard/summary": {
    get: {
      tags: ["Dashboard"],
      summary: "Aggregated dashboard summary",
      security: bearerAuth,
      responses: { "200": successRes(), ...E_401, ...E_500 },
    },
  },

  // ============================ EXPENSE ============================
  "/api/expense/list": {
    get: {
      tags: ["Expense"],
      summary: "List expenses",
      security: bearerAuth,
      responses: { "200": listRes(), ...E_401, ...E_500 },
    },
  },
  "/api/expense/create": {
    post: {
      tags: ["Expense"],
      summary: "Create an expense",
      security: bearerAuth,
      parameters: [idempotencyHeader],
      requestBody: jsonBody("ExpenseCreateRequest"),
      responses: { "201": successRes("Expense created"), ...E_400, ...E_401, ...E_409, ...E_500 },
    },
  },
  "/api/expense/{id}": {
    delete: {
      tags: ["Expense"],
      summary: "Delete an expense",
      security: bearerAuth,
      parameters: [idPath],
      responses: { "200": successRes("Expense deleted"), ...E_401, ...E_404, ...E_500 },
    },
  },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "BillBook API",
    version: "1.0.0",
    description:
      "REST API for BillBook (billing, inventory, parties, accounts). " +
      "Auth is JWT Bearer: call `/api/auth/login` (or `/register`), copy the `token`, " +
      "click **Authorize**, and paste it. All non-auth endpoints require it.",
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "Auth", description: "Signup, login, email-OTP, profile" },
    { name: "Item", description: "Products, categories, stock, reference data" },
    { name: "Party", description: "Customers & suppliers" },
    { name: "Sale", description: "Sale invoices" },
    { name: "Purchase", description: "Purchase invoices" },
    { name: "Document", description: "Documents" },
    { name: "Payment", description: "Payments" },
    { name: "Demo", description: "Demo bookings (admin sub-routes)" },
    { name: "Account", description: "Cash & bank accounts, transfers, transactions" },
    { name: "Dashboard", description: "Aggregated summary" },
    { name: "Expense", description: "Expenses" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the JWT returned by login/register.",
      },
    },
    schemas,
  },
  paths,
};
