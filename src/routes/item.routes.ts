import { Router } from "express";
import {
  createItem,
  getItems,
  getItemsPaged,
  getItemById,
  createItemCategory,
  getItemCategories,
  getTaxes,
  getUnits,
  updateItem,
  updateItemStock,
  bulkCreateItems,
} from "../controllers/item.controller";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { updateStockSchema, categorySchema } from "../validation/schemas";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(requireAuth);

// Item create sends up to 5 images under the field name "itemImages".
router.post("/create", upload.array("itemImages", 5), asyncHandler(createItem));
router.post("/bulk-create-items", upload.single("file"), asyncHandler(bulkCreateItems));

router.get("/items", asyncHandler(getItems));
router.get("/items-paged", asyncHandler(getItemsPaged));
router.get("/get-item", asyncHandler(getItemById));

router.post(
  "/create-item-category",
  validate(categorySchema),
  asyncHandler(createItemCategory)
);
router.get("/get-item-catagories", asyncHandler(getItemCategories));

router.get("/taxes", asyncHandler(getTaxes));
router.get("/units", asyncHandler(getUnits));

router.put("/update-item-stock", validate(updateStockSchema), asyncHandler(updateItemStock));
// Item update accepts up to 5 new images under "itemImages" (existing kept).
router.put("/update/:id", upload.array("itemImages", 5), asyncHandler(updateItem));

export default router;
