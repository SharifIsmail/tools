# Software Architecture

This document outlines the modular architecture for the Personal Assistant application, designed to support parallel development and testability.

## 1. Modular Breakdown

The application is divided into distinct services/modules to separate concerns:

*   **UI Layer**: React Components (Sidebar, Editor, Command Palette). Strict separation from business logic.
*   **State Store**: Global state management (Files, Auth User, Settings).
*   **DriveService**: Handles all Google Drive API interactions (Read/Write/List).
*   **CacheService**: Manages `IndexedDB` persistence and LRU eviction. Intercepts calls from DriveService where appropriate.
*   **EditorModule**: Wrapper around Milkdown/ProseMirror. Handles Markdown parsing and rendering.
*   **IndexService**: Manages the Search Index (`tf-idf` or vector). Handles background updates.
*   **AIService**: Interface for external AI APIs (OpenAI/Gemini).

## 2. Component Architecture (High-Level Data Flow)

This diagram visualizes the dependencies between modules. Each arrow represents a data flow or function call. The clear separation allows **DriveService** or **AIService** to be mocked entirely/swapped out without affecting the UI.

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
        
        class DriveService["Drive Service"] {
            +listFiles()
            +readFile()
            +writeFile()
        }
        
        class CacheService["Cache Service"] {
            +get(id)
            +set(id, content)
            +evict()
        }
        
        class IndexService["Index Service"] {
            +buildIndex()
            +search(query)
            +queueFile(id, content)
        }
        
        class AIService["AI Service"] {
            +generate(prompt)
            +summarize(text)
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
    Store --> DriveService : Fetch/Sync
    Store --> CacheService : Fast Read / Persist
    Store --> IndexService : Queue Updates
    Store --> AIService : Request Intel

    %% Service Dependencies
    DriveService --> GoogleDriveAPI : Network Calls
    CacheService --> IndexedDB : Storage
    AIService --> OpenAI : Network Calls
    IndexService --> CacheService : Read/Write Index Blob
    
    %% Cache fallback
    CacheService ..> DriveService : Fallback on Miss
```

### Module Responsibilities

| Module | Responsible For | Communicates With |
| :--- | :--- | :--- |
| **Store** | Single Source of Truth. Dispatches actions. | All Services & UI |
| **DriveService** | GAPI abstractions. Handling Auth & API quotas. | GAPI (External) |
| **CacheService** | Performance & Persistence. Hiding IndexedDB complexity. | DriveService (Fallback) |
| **IndexService** | Maintaining search index (Vector/TF-IDF) & syncing to App Root. | CacheService, DriveService |
| **AIService** | Abstraction for LLM calls (Stateless). | External APIs |


## 3. Parallel Development Strategy

*   **Developer A (Core/Drive)**: Implement `DriveService` and `CacheService`. Mock GAPI for tests.
*   **Developer B (Editor)**: Implement `EditorModule` (Milkdown) and `Autosave` logic.
*   **Developer C (UI/State)**: Build `Sidebar`, `CommandPalette`, and connect to `State Store`.
*   **Developer D (AI/Index)**: Implement `IndexService` logic and `AIService` integration.
