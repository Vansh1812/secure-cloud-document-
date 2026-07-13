const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Document = require("../models/Document");
const { protect } = require("../middleware/auth");
const { getUploadUrl, getDownloadUrl, deleteObject } = require("../config/aws");

const router = express.Router();

// Only allow a safe, known set of content types
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// STEP 1 — client asks for a presigned URL before uploading anything
router.post("/upload-url", protect, async (req, res, next) => {
  try {
    const { fileName, contentType, sizeBytes } = req.body;

    if (!fileName || !contentType || !sizeBytes) {
      return res.status(400).json({ message: "fileName, contentType, and sizeBytes are required" });
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(415).json({ message: "File type not allowed" });
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({ message: "File exceeds 25MB limit" });
    }

    // Namespacing by user id is what makes IAM/prefix-based access control
    // possible later, and stops one user's files colliding with another's.
    const key = `users/${req.user._id}/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const uploadUrl = await getUploadUrl(key, contentType);

    const doc = await Document.create({
      owner: req.user._id,
      originalName: fileName,
      s3Key: key,
      contentType,
      sizeBytes,
      status: "pending",
    });

    res.status(201).json({ uploadUrl, documentId: doc._id, s3Key: key });
  } catch (err) {
    next(err);
  }
});

// STEP 2 — client confirms the direct-to-S3 upload succeeded
router.patch("/:id/confirm", protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.status = "uploaded";
    await doc.save();
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// LIST — only documents the user owns or that were shared with them
router.get("/", protect, async (req, res, next) => {
  try {
    const docs = await Document.find({
      status: "uploaded",
      $or: [{ owner: req.user._id }, { sharedWith: req.user._id }],
    }).sort({ createdAt: -1 });

    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// DOWNLOAD — issue a fresh, short-lived presigned GET URL
router.get("/:id/download-url", protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      $or: [{ owner: req.user._id }, { sharedWith: req.user._id }],
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const url = await getDownloadUrl(doc.s3Key);
    res.json({ url, expiresIn: process.env.PRESIGNED_URL_EXPIRY_SECONDS || 300 });
  } catch (err) {
    next(err);
  }
});

// SHARE — grant another user read access
router.post("/:id/share", protect, async (req, res, next) => {
  try {
    const { userId } = req.body;
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!doc.sharedWith.includes(userId)) {
      doc.sharedWith.push(userId);
      await doc.save();
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE — only the owner can delete; removes from S3 and MongoDB
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await deleteObject(doc.s3Key);
    await doc.deleteOne();
    res.json({ message: "Document deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
