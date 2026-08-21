# Anchor — College Second Brain

## 1. Overview
Anchor is a college second brain designed for students to organize resources, extract actionable knowledge, and stay on top of deadlines. Scattered college information—syllabi, reading materials, web pages, and personal notes—are ingested by Anchor, where AI extracts structured data to create an organized knowledge base and automatic, actionable tasks. This project was created to solve the problem of information fragmentation and missed deadlines in fast-paced academic environments.

## 2. Live Demo
[Live Demo](https://anchor-lime-two.vercel.app/)

## 3. Features

### Authentication
- Sign up
- Login
- Logout
- User-specific data

### Knowledge Library
- PDF uploads
- Image uploads
- Text notes
- URLs
- Search
- Filtering
- Categories
- Tags
- Bookmarks

### AI Resource Analysis
Gemini analyzes resources and extracts:
- Summary
- Category
- Tags
- Important information
- Deadlines
- Action items
- Content text for knowledge queries

### Automatic Task Creation
AI-extracted action items can become tasks with:
- Title
- Description
- Deadline
- Priority/category
- Source resource
- Status

### Ask My Knowledge
Anchor offers grounded question answering over the user's stored knowledge. It uses relevant stored resource content and instructs Gemini to avoid inventing unavailable information, strictly grounding responses in what you have saved.

### Resource Details
- Metadata
- AI analysis
- PDF/document preview
- Bookmark
- Delete
- AI analysis actions

### UI
- Glassmorphism / soft neo-brutalist visual design
- Light mode
- Dark mode
- Responsive layouts
- Keyboard-accessible interactions

## 4. Tech Stack

Frontend:
- React
- JavaScript
- Vite
- CSS

Authentication:
- Firebase Authentication

Database:
- Firebase Firestore

Storage:
- Supabase Storage

AI:
- Google Gemini API

Backend:
- Vercel Serverless Functions
- Firebase Admin SDK

Testing:
- Vitest
- React Testing Library
- jsdom

## 5. Architecture
```
User
 ↓
React/Vite Frontend
 ↓
Firebase Authentication
 ↓
Firestore
```
For protected server operations:
```
React
 ↓
Vercel Serverless API
 ↓
Firebase Admin verification
 ↓
Gemini / Supabase
```
- **React/Vite Frontend**: Renders the UI and routes user actions.
- **Firebase Authentication**: Manages secure user sessions.
- **Firestore**: Stores user metadata, library, and tasks, separated by UID.
- **Vercel Serverless API**: Provides secure endpoints for AI processing and storage URL generation.
- **Firebase Admin SDK**: Verifies user auth tokens on the server.
- **Gemini / Supabase**: Processes AI queries and manages binary blob storage on the server backend.

## 6. Project Structure
```text
src/
├── components/
├── pages/
├── services/
├── config/
├── __tests__/
├── App.jsx
└── index.css

api/
├── ai/
├── storage/
└── utils/

public/
```

## 7. AI Integration
The AI integration follows this pipeline:
```
Resource
↓
Content extraction
↓
Vercel API
↓
Gemini
↓
Structured JSON
↓
Firestore
↓
Tasks / Knowledge Search
```
Gemini extracts structured fields such as:
```json
{
  "summary": "...",
  "category": "...",
  "tags": ["..."],
  "importantInformation": ["..."],
  "deadlines": [{ "date": "...", "description": "..." }],
  "actionItems": [{ "title": "...", "description": "..." }],
  "contentText": "..."
}
```
Structured output is used instead of free-form AI responses so the application can reliably parse dates, generate actionable UI task cards, and categorize content automatically without brittle text parsing.

## 8. Grounded Knowledge Questions
1. User asks a question.
2. Anchor searches the user's stored resources.
3. Relevant resource content is provided to Gemini.
4. Gemini generates an answer based on that context.
5. If sufficient information is unavailable, Anchor tells the user instead of inventing information.

The system is intentionally designed to reduce hallucination by strictly grounding the LLM in local context.

## 9. AI Safety and Reliability
- Structured JSON validation
- Missing information handling
- AI error fallback
- Prompt-injection boundaries
- Input limits
- Server-side Gemini API key
- No fabrication of missing deadlines/information

## 10. Security

### Authentication
Firebase Authentication + Firebase Admin token verification.

### Database
Firestore rules isolate user data by authenticated UID.

### Storage
Supabase Storage operations are performed through authenticated serverless functions using a server-side service-role credential.

### Secrets
Gemini and Supabase service-role credentials remain server-side.

### URL Security
URL ingestion contains SSRF protections against localhost, private/internal IP ranges, and cloud metadata addresses.

## 11. Environment Variables

Client:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_SUPABASE_URL
```

Server:
```
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```
Actual values must never be committed. Create `.env.local` for development and configure production secrets directly in Vercel.

## 12. Local Setup
```bash
git clone <repository>
cd Anchor
npm install
npm run dev
```
Configure a `.env.local` file at the root of the project mimicking the environment variables listed above.

## 13. Running Tests
```bash
npm run test
```
Runs the Vitest suite validating core React components, utility logic, and isolated state rendering.

```bash
npm run coverage
```
Runs the test suite with v8 coverage instrumentation to generate coverage reports.

```bash
npm run build
```
Compiles and bundles the Vite React application into a static production build.

## 14. Testing Evidence
Verified test result: 20/20 tests passing.
Tests validate core UI components (Dashboard, Tasks, Library, Resource Details, AskMyKnowledge) and critical AI/storage logic. The configured overall statement coverage is 26.44%, representing focused coverage of critical functionality rather than 100% monolithic coverage.

## 15. Accessibility
- Lighthouse Accessibility: 94
- Keyboard navigation
- Focus visibility
- Form labels
- Button accessibility
- Contrast
- Reduced motion
- Responsive accessibility

Concrete improvements made:
- explicit checkbox association
- accessible bookmark search label
- improved muted-text contrast
- explicit placeholder styling

Anchor was audited against WCAG 2.1 AA principles and no blocking violations were identified in the final audit.

## 16. Performance
Verified Lighthouse results (Stable Baseline):

Desktop:
- Performance: 99
- Accessibility: 94
- Best Practices: 100
- SEO: 91

Mobile:
- Performance: 57
- Accessibility: 94
- Best Practices: 100
- SEO: 91

A vendor code-splitting experiment was tested but reverted because it improved mobile TBT while significantly regressing desktop performance (due to sequential request chaining). The application maintains high desktop performance by leveraging route-level `React.lazy()` code splitting. Mobile Lighthouse performance remains an area for future optimization.

## 17. Error Handling
- AI failures: Handled gracefully with fallback messages.
- upload failures: Caught and displayed via toast/error boundaries.
- invalid files: Prevented early on the client-side.
- authentication failures: Managed automatically by routing users back to login.
- URL extraction failures: Provides generic fallback parsing.
- malformed AI output: Validated and replaced with empty/default objects.
- network errors: Displays user-friendly errors rather than raw server stack traces.

## 18. Deployment
```
GitHub
↓
Vercel
↓
Production build
↓
Live application
```
Production environment variables must be configured directly within the Vercel dashboard. The application features automatic deployment from the main branch, utilizing Vercel serverless API functions automatically mapped from the `/api/` directory.

## 19. Rollback Plan
1. Open Vercel Deployments.
2. Identify the last known-good deployment.
3. Promote/restore that deployment to production.
4. If necessary, revert the problematic Git commit and push the revert.

## 20. Monitoring
Anchor currently relies on:
- Vercel deployment logs
- Vercel serverless function logs
- basic Vercel analytics where available

## 21. Known Limitations
- URL extraction may not work for heavily JavaScript-rendered websites.
- AI results depend on the quality/content of the uploaded resource.
- No real-time collaboration.
- No native mobile application.
- Mobile Lighthouse performance remains an area for future optimization.

## 22. Future Improvements
- Better web-page extraction for dynamic websites
- More comprehensive end-to-end testing
- Further mobile performance optimization
- Improved knowledge retrieval for larger libraries
- Optional calendar integration

## 23. Screenshots

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Library
![Library](./screenshots/library.png)

### Resource Details
![Resource Details](./screenshots/resource-details.png)

### Tasks
![Tasks](./screenshots/tasks.png)

### Ask My Knowledge
![Ask My Knowledge](./screenshots/ask-my-knowledge.png)

### Mobile UI
![Mobile UI](./screenshots/mobile-ui.png)
