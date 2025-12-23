# Software Architecture

This document outlines the modular architecture for the Personal Assistant application, designed to support parallel development and testability.

## 1. Modular Breakdown

The application is divided into distinct services/modules to separate concerns:

*   **UI Layer**: React Components (Sidebar, Editor, Command Palette). Strict separation from business logic.
*   **State Store**: Global state management (Files, Auth User, Settings).
*   **VirtualFileSystem (VFS)**: Unified repository for file operations. Orchestrates Caching (IndexedDB) and Network (DriveAdapter).
*   **DriveAdapter**: Internal adapter for Google Drive API interactions (Read/Write/List).
*   **EditorModule**: Wrapper around Milkdown/ProseMirror. Handles Markdown parsing and rendering.
*   **IndexService**: Manages the Keyword/Entity Index. Interactions with VFS for file access.
*   **AIService**: Interface for external AI APIs (OpenAI/Gemini).

## 2. Component Architecture (High-Level Data Flow)

This diagram visualizes the dependencies between modules. The **VirtualFileSystem** acts as the single data gatekeeper, abstracting away the complexity of caching and network synchronization.

```mermaid
classDiagram
    direction TB

    namespace External_Systems {
        class GoogleDriveAPI["Google Drive API"]
        class OpenAI["OpenAI / Gemini API"]
        class IndexedDB["Browser IndexedDB"]
    }

    namespace Application_Logic {
        class Store["State Store (Zustand/Redux)"] {
            +auth_state
            +file_tree
            +current_file_content
            +settings
        }
        
        class VFS["VirtualFileSystem"] {
            +listFiles()
            +readFile(id)
            +writeFile(id, content)
            +createCopy(id)
        }

        class DriveAdapter["Drive Adapter"] {
             +fetch(id)
             +push(id, content)
        }
        
        class IndexService["Index Service"] {
            +buildIndex()
            +search(query)
            +queueFile(id)
        }
        
        class AIService["AI Service"] {
            +generate(prompt)
            +extractMetadata(text)
        }
    }

    namespace UI_Layer {
        class Sidebar["Sidebar UI"]
        class Editor["Editor (Milkdown)"]
        class CommandPalette["Command Palette"]
    }

    %% Relationships
    
    %% UI depends on Store
    Sidebar ..> Store : Reads Tree
    Editor ..> Store : Reads Content / Writes Edits
    CommandPalette ..> Store : Reads Index / Dispatches

    %% Store Coordinates Services
    Store --> VFS : Read/Write Files
    Store --> IndexService : Query Index
    Store --> AIService : Request Intel

    %% VFS Internals
    VFS --> DriveAdapter : Network Sync
    VFS --> IndexedDB : Caching
    DriveAdapter --> GoogleDriveAPI : API Calls

    %% Service Dependencies
    AIService --> OpenAI : Network Calls
    IndexService --> VFS : Read Content / Write Index
    
```

### Module Responsibilities

| Module | Responsible For | Communicates With |
| :--- | :--- | :--- |
| **Store** | Single Source of Truth. Dispatches actions. | VFS, IndexService, AIService |
| **VFS** | **Repository Pattern**. Manages Caching (IndexedDB) & Syncing (Drive). | DriveAdapter, IndexedDB |
| **DriveAdapter** | Minimal GAPI wrapper. | GAPI (External) |
| **IndexService** | Maintaining **Keyword/Entity Index** & syncing to App Root. | VFS, AIService |
| **AIService** | Abstraction for LLM calls (Metadata Extraction). | External APIs |


## 3. Parallel Development Strategy

*   **Developer A (Core/VFS)**: Implement `VirtualFileSystem`, `DriveAdapter`, and `IndexedDB` logic.
*   **Developer B (Editor)**: Implement `EditorModule` (Milkdown) and `Autosave` logic.
*   **Developer C (UI/State)**: Build `Sidebar`, `CommandPalette`, and connect to `State Store`.
*   **Developer D (AI/Index)**: Implement `IndexService` logic and `AIService` integration.

## 4. Indexing Strategy

To fulfill the "Whole Drive" indexing requirement scalably on the client-side, the system uses a **Keyword & Entity Extraction** approach (Semantic Metadata) rather than full vector embeddings.

### 4.1. Index Structure
The index is a JSON file stored via VFS at `/.app_state/index.json`. It contains:
1.  **Metadata Map**: `FileID -> { Path, LastModified, Checksum }`
2.  **Content Index**: `FileID -> { Summary: string, Keywords: string[], Entities: string[] }`
3.  **Search Map**: Inverted index mapping `keyword -> [FileIDs]` for instant fuzzy search.

### 4.2. Build Process (The "Background Crawler")
The `IndexService` runs a non-blocking background loop:
1.  **Crawler**: Calls `VFS.listFiles()` (pages of 1000). Compares `LastModified` against local Index.
2.  **Queue**: Pushes changed/new FileIDs into a persistent `IndexingQueue` (IndexedDB).
3.  **Worker**:
    *   Pops batch of files from Queue.
    *   Calls `VFS.readFile(id)` to fetch text content.
    *   **Calls AIService**: Sends text to LLM (e.g. `gpt-4o-mini`) with prompt: *"Extract 5 keywords, named entities, and a 1-sentence summary."*
    *   Updates `Content Index` and `Search Map`.
4.  **Sync**: Periodically calls `VFS.writeFile()` to save `/.app_state/index.json`.

### 4.3. Search Process
When the user queries via Command Palette:
1.  **Local Search**: Fuzzy matches user query against the `Search Map` (Keywords/Entities/Filenames).
2.  **Ranking**: Scores results based on match weight (Entity > Keyword > Body Text).
3.  **Result**: Returns instant results without needing an API call at search time.
