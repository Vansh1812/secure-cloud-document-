# Vault — Secure Cloud Document Management System

A full-stack document management app: React frontend, Express/MongoDB backend,
and AWS S3 for storage — built so the server never sees raw file bytes and
every file operation is authenticated and short-lived.
## Live deploy link:-
https://doc-mang.netlify.app/
## Architecture

```
┌────────────┐        JWT auth         ┌────────────┐        metadata only      ┌───────────┐
│   React    │ ───────────────────────▶│  Express   │ ─────────────────────────▶│  MongoDB  │
│  frontend  │◀─────────────────────── │    API     │◀───────────────────────── │  (Atlas)  │
└────────────┘   presigned S3 URL      └────────────┘                           └───────────┘
      │                                      │
      │           direct PUT/GET             │ IAM role / least-privilege
      └───────────────────────────────────▶  ▼
                                        ┌────────────┐
                                        │   AWS S3   │  (SSE-S3 encryption,
                                        │   bucket   │   public access blocked)
                                        └────────────┘
```

**Key design decision: the file bytes never pass through our server.**
The Express API only ever hands the browser a presigned URL; the browser
uploads/downloads directly to/from S3. This keeps the API stateless, fast,
and out of the business of buffering large files — and it's the AWS-recommended
pattern for this kind of app.

## Security features (what to highlight in your writeup)

- **Authentication** — bcrypt-hashed passwords (cost factor 12), JWT-based
  sessions, rate-limited login/register endpoints to slow brute-force attempts.
- **Authorization** — every document route checks `owner`/`sharedWith` against
  `req.user._id` from the verified JWT; users can only ever see or act on
  their own (or shared) documents.
- **No public file URLs** — every upload and download uses a presigned S3 URL
  that expires in 5 minutes (`PRESIGNED_URL_EXPIRY_SECONDS`), scoped to one
  object key and one operation (PUT or GET).
- **Least-privilege IAM** — `iam-policy.json` restricts the app's AWS
  credentials to `PutObject`/`GetObject`/`DeleteObject` on the `users/*`
  prefix only, denies unencrypted uploads, and denies any request that
  isn't over HTTPS.
- **Encryption at rest** — every upload sets `ServerSideEncryption: AES256`;
  the bucket policy (below) also blocks all public access at the bucket level.
- **Input hardening** — `express-mongo-sanitize` strips NoSQL-injection
  operators, `helmet` sets standard security headers, file type/size are
  validated server-side before a presigned URL is even issued (allow-list of
  content types, 25MB cap).
- **No secrets in the client** — AWS credentials live only on the server
  (or better, an IAM role if deployed on EC2/ECS); the frontend never touches
  AWS credentials, only short-lived URLs.

## AWS setup

1. **Create the S3 bucket**
   ```
   aws s3api create-bucket --bucket YOUR_BUCKET_NAME --region us-east-1
   aws s3api put-public-access-block --bucket YOUR_BUCKET_NAME \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-encryption --bucket YOUR_BUCKET_NAME \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```
2. **Set CORS on the bucket** (so the browser can PUT directly to S3):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:5173"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```
3. **Create an IAM user (or role)** and attach `iam-policy.json` (replace
   `YOUR_BUCKET_NAME` in the file first). If deploying to EC2/ECS, attach the
   policy to an instance/task role instead of using long-lived access keys.
4. **MongoDB** — either run locally (`mongod`) or create a free MongoDB Atlas
   cluster and use that connection string.

## Local setup

**Backend**
```
cd backend
cp .env.example .env      # fill in MONGO_URI, JWT_SECRET, AWS_* , S3_BUCKET_NAME
npm install
npm run dev                # http://localhost:5000
```

**Frontend**
```
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173, register an account, and upload a file — it goes
straight to S3 via a presigned URL, and the ledger shows owner-scoped
metadata pulled from MongoDB.

## Pull and run from Docker Hub (on any machine with Docker)

bash:-
docker pull yourusername/secure-doc-backend:latest

docker pull yourusername/secure-doc-frontend:latest

docker network create secure-doc-net

docker run -d --name backend --network secure-doc-net -p 5000:5000 \
  -e MONGO_URI="..." \
  -e JWT_SECRET="..." \
  -e CLIENT_URL="http://localhost:8080" \
  -e AWS_REGION="ap-south-1" \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  -e S3_BUCKET_NAME="..." \
  yourusername/secure-doc-backend:latest

docker run -d --name frontend --network secure-doc-net -p 8080:80 \
  yourusername/secure-doc-frontend:latest

## API summary

| Method | Route                              | Auth | Purpose                              |
|--------|-------------------------------------|------|---------------------------------------|
| POST   | /api/auth/register                  | —    | Create account, returns JWT           |
| POST   | /api/auth/login                     | —    | Login, returns JWT                    |
| POST   | /api/documents/upload-url           | ✅   | Get a presigned PUT URL               |
| PATCH  | /api/documents/:id/confirm          | ✅   | Mark upload as complete               |
| GET    | /api/documents                      | ✅   | List owned + shared documents         |
| GET    | /api/documents/:id/download-url     | ✅   | Get a presigned GET URL               |
| POST   | /api/documents/:id/share            | ✅   | Grant another user read access        |
| DELETE | /api/documents/:id                  | ✅   | Delete from S3 and MongoDB            |

## Suggested next steps for extra credit

- Add file versioning (S3 bucket versioning + a `version` field on `Document`)
- Add virus scanning on upload (e.g., trigger a Lambda with ClamAV on `s3:ObjectCreated`)
- Add an audit log collection recording every download/share/delete event
- Deploy: frontend to S3+CloudFront or Vercel, backend to ECS/Elastic Beanstalk,
  MongoDB Atlas, all behind HTTPS
