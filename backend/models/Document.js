const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true },
    s3Key: { type: String, required: true, unique: true }, // e.g. users/<userId>/<uuid>-filename.pdf
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: ["pending", "uploaded"], default: "pending" },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
