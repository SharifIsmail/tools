# Product Requirements Document: Personal Assistant & Organizer App

## 1. Overview
The goal is to build a note-taking, personal organizer, self-leadership, and personal assistant application. The application will be a static site leveraging Google Drive as its backend for storage and file management.

## 2. Constraints & Compliance

### 2.1 Security & Permissions (CASA Tier 2)

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-SEC-01** | The application **MUST NOT** request the sensitive `https://www.googleapis.com/auth/drive` (full access) scope. | Inspect OAuth config code. |
| **REQ-SEC-02** | The application **MAY** request ONLY: `drive.readonly` (all files), `drive.file` (created by app), and `drive.labels`. | Inspect OAuth config code. |
| **REQ-SEC-03** | The application must operate using only the permitted scopes. | Authenticate app and verify consent screen lists only allowed scopes. |

### 2.2 Architecture

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-ARCH-01** | The application **MUST** be built as a Static Site (HTML, CSS, JS). | N/A |
| **REQ-ARCH-02** | The application **MUST NOT** rely on a dynamic backend server. Must run entirely in browser. | Deploy to static host (e.g. GitHub Pages) and verify functionality. |

## 3. User Experience & Performance

### 3.1 Responsiveness & Caching

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-PERF-01** | **Optimistic UI**: Every user interaction **MUST** result in visual feedback/state change within **20ms**. | DevTools Performance: Measure time from `Input` to next `Paint`. Must be ≤ 20ms. |
| **REQ-PERF-02** | **Caching**: The application **MUST** implement an aggressive caching and prefetching strategy. | Check network tab for prefetching activity. |
| **REQ-PERF-03** | **Speed**: **95%** of navigations **MUST** resolve using cached/prefetched data within **20ms**. | Perform 20 random navigations. 19/20 must load instantly (<20ms) without network blocking. |
| **REQ-PERF-04** | **Persistence**: Cache **MUST** be persisted to **IndexedDB** to survive session restarts. | Reload page/browser. Navigate to previously visited file. Verify 0 network requests for content. |
| **REQ-PERF-05** | **Eviction Policy**: Cache **MUST** enforce a **Developer-Configurable TOTAL** size limit (in MB) using an **LRU** (Least Recently Used) eviction policy. | Set small limit (e.g. 1MB). Load files > 1MB total. Verify least recently accessed files are removed from IndexedDB. |

## 4. Functional Requirements

### 4.1 File System & Content

> [!IMPORTANT]
> **Write Access Limitation**: With `drive.file` scope, the application can ONLY edit files that were created by the application itself. If the Configurable Root Folder contains pre-existing files, the app may be Read-Only for those files unless the user manually grants write access or migrates them.

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-FS-01** | **Global Read Access**: App **MUST** be able to read **ALL** files and folders in the user's entire Drive hierarchy (using `drive.readonly` scope), not just the **App Root Folder**. | Use test account. Create file outside `/MyNotes`. Verify app can find/read it via Command Palette. |
| **REQ-FS-02** | **App Root Folder**: App **MUST** function within a configurable **App Root Folder** (e.g. `/MyNotes`). Sidebar and App State **MUST** be contained/scoped to this folder. | Change config to `/TestNotes`. Verify Sidebar only shows files in `/TestNotes`. |
| **REQ-FS-03** | **App State Storage**: App state (indices, config) **MUST** be stored in a dedicated hidden subfolder named `/.app_state` located **directly inside** the **App Root Folder**. | Check Drive for `.app_state` folder inside `/MyNotes` (e.g., `/MyNotes/.app_state`). |
| **REQ-FMT-01** | **Markdown**: App **MUST** support parsing and rendering of GitHub Flavored Markdown (GFM). | Create `test.md` with tables, task lists, strikethrough. Verify rendering. |

### 4.2 Link Resolution

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-NAV-01** | **Relative Links**: **MUST** resolve relative links (e.g., `[Link](./doc.md)`) within Drive. | Create linked files structure. Verify clicking relative link opens target. |
| **REQ-NAV-02** | **Absolute Links**: **MUST** resolve absolute links (e.g. `/Project/Idx.md`) relative to Drive root. | Create absolute link to file. Verify click navigation. |
| **REQ-NAV-03** | **Embeds**: **MUST** resolve and display embedded images using relative paths. | Embed `![Img](../img.png)`. Verify image renders in doc. |
| **REQ-NAV-04** | **Wiki-Links**: **MUST** support `[[Filename]]` syntax for internal linking. | Create `[[Target Note]]`. Click link. Verify it opens `Target Note.md`. |
| **REQ-NAV-05** | **Disambiguation**: **MUST** show a file picker/dropdown if `[[Filename]]` matches multiple files. | Create two `Note.md` files in different folders. Create `[[Note]]`. Verify click triggers options. |

### 4.3 Editor Capabilities

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-EDIT-01** | **WYSIWYG**: The application **MUST** provide a WYSIWYG Markdown editing experience (e.g., via Milkdown or ProseMirror). | Verify rich text editing (bold, list) happens in-place without manual markdown syntax unless desired. |
| **REQ-EDIT-02** | **View Modes**: Users **MUST** be able to switch between WYSIWYG (default) and Raw Source mode. | Toggle view mode. Verify underlying markdown text is visible/editable directly. |
| **REQ-EDIT-03** | **Mobile**: The editor interface **MUST** be fully functional on mobile devices (touch targets, responsiveness). | Load on mobile emulation. Verify text entry and formatting tools work. |
| **REQ-EDIT-04** | **Concurrency**: File saving **MUST** use a "Last Write Wins" strategy. | Open file in two tabs. Save Tab A, then Tab B. Verify Tab B overwrites A. |
| **REQ-EDIT-05** | **Extended Syntax**: The editor **SHOULD** support extended syntax (Mermaid, LaTeX, Footnotes) where possible, but this is **OPTIONAL** for V1. | Create doc with Mermaid diagram. Verify rendering (if implemented) or graceful degradation. |
| **REQ-EDIT-06** | **Autosave**: Edits to text/markdown files **MUST** be autosaved to Drive automatically (e.g. after 1s debounce or on blur). | Type in editor. Wait. Reload page. Verify changes persisted without manual save. |
| **REQ-EDIT-07** | **Copy-on-Edit**: If the user edits a read-only file (e.g. outside **App Root Folder**), the app **MUST** automatically create a writable copy in the **App Root Folder** (e.g. `/MyNotes/Imported`) and save changes there. | Open file from outside `/MyNotes`. Edit it. Verify original is untouched. Verify new file with changes exists in `/MyNotes`. |

## 5. Hosting

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-OPS-01** | **Deployment**: The application **MUST** be deployable to standard static site hosts (GitHub Pages, Cloudflare). | Deploy to target host and verify functionality. |

## 6. AI & Intelligence

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-AI-01** | **External API**: AI processing **MUST** be performed via external API (e.g., OpenAI, Gemini) to maintain "static site" architecture. | Configure valid API key. Verify app sends request to external endpoint (Network tab). |
| **REQ-AI-02** | **Indexing Strategy**: App **MUST** build a search index for the **Entire Drive** by extracting **Keywords, Entities, and Summaries** (not full embeddings) via AI. | Add file in random folder. Wait for crawler. Verify file keywords appear in App State index. |
| **REQ-AI-03** | **API Key Security**: Users **MUST** be able to input API keys safely (e.g., stored in LocalStorage/Session, never committed or shared). | input API key. Reload. Verify key persists locally but is not synced to Drive file content. |
| **REQ-AI-04** | **Background Crawling**: The indexing process **MUST** run in the background (step-by-step), maintaining a persistent queue of un-indexed files to process in parallel batches. | Open app. Verify UI is responsive while "Indexing" indicator is active. Close/Reopen app. Verify indexing resumes where left off. |

## 7. UI & UX

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-UI-01** | **Minimal Styling**: The initial UI **MUST** prioritized functionality over aesthetics, using minimal/browser-native styling where appropriate. | Verify absence of complex themes or animations. Ensure focus is on layout and usability. |
| **REQ-UI-02** | **Sidebar**: **MUST** display file tree of the **App Root Folder**. | Verify file structure matches Drive folder structure. |
| **REQ-UI-03** | **Folder Routing**: Clicking a folder **MUST** open its `index.md` (if exists). Expanding a folder **MUST** show contents but HIDE `index.md` from the list. | Create `/A/index.md` and `/A/other.md`. Click `A`. Verify `index.md` content loads. Expand `A`. Verify `index.md` is hidden, `other.md` is visible. |
| **REQ-UI-04** | **Command Palette**: **MUST** implement a `Cmd/Ctrl+K` palette to search/open **ALL** files (MD and non-MD) in the **Entire Drive**, regardless of location. | Create file outside `/MyNotes`. Search for it. Verify it appears in results. |
| **REQ-UI-05** | **File Handling**: Markdown opens in WYSIWYG. Text files open in simple editor. Others (PDF/Img) open in Browser Preview/Download. | Open `.txt`. Verify editability. Open `.pdf`. Verify browser preview/download. |
