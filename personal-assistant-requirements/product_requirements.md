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

## 4. Functional Requirements

### 4.1 File System & Content

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-FS-01** | **Read Access**: App **MUST** be able to read ALL files in user's Drive hierarchy. | Use test account with existing files. Verify app can list/open them. |
| **REQ-FMT-01** | **Markdown**: App **MUST** support parsing and rendering of GitHub Flavored Markdown (GFM). | Create `test.md` with tables, task lists, strikethrough. Verify rendering. |

### 4.2 Link Resolution

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-NAV-01** | **Relative Links**: **MUST** resolve relative links (e.g., `[Link](./doc.md)`) within Drive. | Create linked files structure. Verify clicking relative link opens target. |
| **REQ-NAV-02** | **Absolute Links**: **MUST** resolve absolute links (e.g. `/Project/Idx.md`) relative to Drive root. | Create absolute link to file. Verify click navigation. |
| **REQ-NAV-03** | **Embeds**: **MUST** resolve and display embedded images using relative paths. | Embed `![Img](../img.png)`. Verify image renders in doc. |

## 5. Hosting

| ID | Requirement | Verification Method |
| :--- | :--- | :--- |
| **REQ-OPS-01** | **Deployment**: The application **MUST** be deployable to standard static site hosts (GitHub Pages, Cloudflare). | Deploy to target host and verify functionality. |
