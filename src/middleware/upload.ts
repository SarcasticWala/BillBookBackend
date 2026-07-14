import multer from "multer";

// Keep files in memory; we stream image buffers to Cloudinary and parse
// Excel buffers directly with SheetJS.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
