const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Credentials are picked up from env vars (or an IAM role if deployed on
// EC2/ECS/Lambda, which is the preferred approach — no keys needed at all).
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.S3_BUCKET_NAME;
const EXPIRY = Number(process.env.PRESIGNED_URL_EXPIRY_SECONDS) || 300;

/**
 * Generates a short-lived presigned URL the browser can PUT the file to
 * directly. The file never passes through our server, and the URL is
 * scoped to one object key and expires quickly.
 */
async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "AES256", // encryption at rest
  });
  return getSignedUrl(s3Client, command, { expiresIn: EXPIRY });
}

/**
 * Generates a short-lived presigned URL to download/view a specific object.
 * Never returns a public/permanent URL — every download is re-authorized.
 */
async function getDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: EXPIRY });
}

async function deleteObject(key) {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  return s3Client.send(command);
}

module.exports = { s3Client, getUploadUrl, getDownloadUrl, deleteObject, BUCKET };
