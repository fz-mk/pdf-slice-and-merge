"This complete tool was fully designed by AI, and it has been carefully reviewed, tested, and officially approved by Fayez."

# Secure PDF Studio: Split & Merge

A high-performance, private, client-side web application for splitting and merging PDF documents. Built with **React**, standard **CSS** (no Tailwind), **pdf-lib**, and **jszip**.

All operations execute strictly in the client's web browser memory. Documents are never transmitted to an external server, offering true confidentiality for legal, financial, and personal records.

---

## Key Features

### 1. PDF Splitter
- **Even Page Distribution**: Specify the desired number of parts ($k$), and the app dynamically calculates the distribution using:
  $$\text{baseSize} = \lfloor N / k \rfloor, \quad \text{remainder} = N \pmod k$$
  The first `remainder` parts receive $\text{baseSize} + 1$ pages, while the remaining parts receive $\text{baseSize}$ pages.
- **Strict Naming Convention**: Each generated split file is named in ascending order:
  `[OriginalFileName]_1.pdf`, `[OriginalFileName]_2.pdf`, etc.
- **ZIP Packaging**: All extracted PDF parts are compressed and bundled on the fly into a single `[OriginalFileName]_split.zip` file using `jszip`.

### 2. PDF Merger
- **Multi-File Upload**: Select or drag-and-drop multiple PDF files simultaneously.
- **Visual Sorter & Reordering**: Reorder files before merging using intuitive **Drag-and-Drop** or accessible **Move Up / Move Down** controls.
- **Strict Sequence Execution**: Files are merged strictly according to the user-arranged sequence into a cohesive `merged_document.pdf`.
- **Pre-Merge Insights**: Displays file sizes, individual page counts, and total combined page metrics before processing.

### 3. Multi-Layer Security Architecture
- **Strict File Extension Validation**: Only files terminating in `.pdf` (case-insensitive) are accepted.
- **MIME Type Verification**: Strictly restricts MIME types to `application/pdf` or `application/x-pdf`.
- **Binary Magic Byte Inspection**: Analyzes the file's raw header bytes (`%PDF-` / `0x25 0x50 0x44 0x46 0x2D`). Disguised executables, shell scripts, audio, or images disguised as `.pdf` are blocked before parsing.
- **Encryption Detection**: Detects password-protected/encrypted PDFs and informs the user gracefully without crashing.
- **Memory Safety**: Object URLs created during download triggers are immediately revoked via `URL.revokeObjectURL()` to prevent client memory bloat.

### 4. UI/UX Design System
- Built with **pure standard CSS** using CSS Custom Properties (Variables).
- Sleek dark aesthetic with glassmorphic depth (`backdrop-filter: blur`), glowing gradient highlights, and tactile button feedback.
- Real-time animated **Progress Bar** with step-by-step progress tracking, percentages, and live status messaging.
- Fully responsive across mobile, tablet, and widescreen displays.

---

## Project Structure

```text
secure-pdf-split-merge/
├── index.html              # HTML entry with favicon references
├── package.json            # Project dependencies & scripts
├── public/
│   └── favicon.svg         # Modern vector icon for the application
├── src/
│   ├── App.jsx             # Main React component (Split, Merge, Security logic)
│   ├── App.css             # Vanilla CSS design system (No Tailwind)
│   └── main.jsx            # React root mount point
└── README.md               # Documentation & Run guide