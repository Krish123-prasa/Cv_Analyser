# Elevate Resume Studio

A full-stack resume management and job-match application. The frontend is a classic, responsive React workspace; the API is Express and MongoDB. Users can create an account, upload private PDF/DOCX source resumes, compare them with job descriptions, generate tailored editions, and choose PDF or editable DOCX downloads.

## Requirements

- Node.js 20 or newer
- MongoDB running locally, or a MongoDB Atlas connection string
- An OpenAI-compatible API key for AI analysis and resume generation (optional for local keyword analysis and conservative tailoring)

## Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file and edit the values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `MONGODB_URI` to your database and `JWT_SECRET` to a random secret of at least 32 characters. Set `CLIENT_ORIGIN` to your frontend origin when it differs from `http://localhost:5173`. To generate a secret in PowerShell:

   ```powershell
   node -p "require('crypto').randomBytes(48).toString('base64')"
   ```

3. Optional: set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` in `.env`. The key stays on the server. With no key, resume comparison and conservative keyword-based tailoring run locally.

4. Start the frontend and API:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:5173`. Vite proxies `/api` requests to Express on port 5000. For a production-style local run, use `npm run build` followed by `npm start`; Express then serves the built frontend and API on port 5000.

   To run the production app and MongoDB with Docker Compose, configure `.env` as above and run:

   ```powershell
   docker compose up --build
   ```

   Open `http://localhost:5000`. MongoDB and uploaded files use named persistent volumes.

## Deploy to Vercel

Import the repository with its root directory set to the repository root (not `client/dist`). Vercel uses `vercel.json` to build the frontend into `client/dist` and deploys the `/api/*` serverless function from `api/[...path].js`; do not deploy the generated `dist` folder by itself.

Add these environment variables in the Vercel project settings for each deployment environment:

- `MONGODB_URI`: a MongoDB Atlas connection string accessible from Vercel
- `JWT_SECRET`: a random secret of at least 32 characters

Redeploy after saving the variables. The API and frontend use the same Vercel origin, so no `CLIENT_ORIGIN` setting is needed. The current resume-file implementation writes to local disk; Vercel's function filesystem is temporary, so configure persistent file storage or host the backend on a persistent server before relying on resume uploads and downloads in production.

## Deploy to Netlify

Connect the repository root to Netlify; `netlify.toml` builds and publishes the frontend and routes `/api/*` to the Express function in `netlify/functions/api.js`. Add `MONGODB_URI` and `JWT_SECRET` in Netlify's environment variables, then deploy. Do not select `client/dist` as the base directory. Netlify function storage is also temporary, so the same persistent-file-storage limitation applies to resume uploads and downloads.

## What is included

- Email/password registration and sign-in, bcrypt password hashing, and HTTP-only JWT session cookies
- Private, per-account resume storage with PDF and DOCX text extraction
- Monochrome tailored exports in either PDF or editable DOCX format, selected by the user. PDF exports follow the source resume's section order, detected page dimensions, margins, font family, text sizing, and name alignment; DOCX exports preserve its headings, sections, and structured content. Original graphics and exact decorative elements are not copied.
- Post-generation review shows an inline PDF preview for both download formats, job-match score, matched and missing requirements, and basic ATS readability checks. Download is gated on the user's confirmation that they reviewed the content.
- A private profile page lets all account types manage contact details, user category, professional headline, links, and multiple academic credentials. Email updates are validated and checked for uniqueness.
- AI-backed resume analysis and tailored plain-language content through an OpenAI-compatible chat-completions API
- Local tailoring when no AI key is configured; summaries can be rebuilt from supported project/skill evidence, and matching skills and project groups are prioritized without inventing candidate facts
- Matched and not-found skills, match score, recommendations, original and tailored downloads, and delete actions
- Per-user data isolation, file-size/type limits, auth rate limiting, Helmet headers, and no public upload directory

AI analysis and phrasing edits send the selected resume text and job description to the provider configured in `.env`. Without an AI key, local tailoring builds a concise summary from evidence already in the resume, prioritizes matching skills and projects, and never rewrites experience or adds claims. Do not enable a third-party provider for documents you are not permitted to share. Review generated content for accuracy and never add a skill or accomplishment you cannot substantiate.

## API outline

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/profile`, `PATCH /api/profile`
- `GET /api/resumes`, `POST /api/resumes`, `POST /api/resumes/:id/analyze`, `GET /api/resumes/:id/download`, `DELETE /api/resumes/:id`
- `GET /api/optimizations`, `POST /api/optimizations` (accepts `outputFormat: "pdf" | "docx"`), `GET /api/optimizations/:id/preview`, `GET /api/optimizations/:id/download`, `DELETE /api/optimizations/:id`
- `GET /api/health`

Run the focused checks with `npm test` and create the frontend production bundle with `npm run build`.
