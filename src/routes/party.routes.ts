import { Router } from "express";
import {
  createParty,
  getParties,
  getPartiesPaged,
  getPartyById,
  updateParty,
  createCategory,
  getCategories,
  getLocations,
  bulkCreateParties,
} from "../controllers/party.controller";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import {
  partyCreateSchema,
  partyUpdateSchema,
  categorySchema,
} from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

router.post("/create", validate(partyCreateSchema), asyncHandler(createParty));
router.get("/parties", asyncHandler(getParties));
router.get("/parties-paged", asyncHandler(getPartiesPaged));
router.get("/get-party/:id", asyncHandler(getPartyById));
router.put("/update-party/:id", validate(partyUpdateSchema), asyncHandler(updateParty));

router.post("/create-category", validate(categorySchema), asyncHandler(createCategory));
router.get("/get-catagories", asyncHandler(getCategories));
router.get("/locations", asyncHandler(getLocations));

router.post("/bulk-create", upload.single("file"), asyncHandler(bulkCreateParties));

export default router;
