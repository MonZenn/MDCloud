# MDCloud ☁️

A private, client-side Markdown note-taking and figure-viewing web application designed for seamless synchronization with your designated Google Drive folder across Mac, iPad, and iPhone. Hosted for free on GitHub Pages.

---

## 🔒 Privacy & Security Architecture

MDCloud is built from the ground up with a **privacy-first, zero-knowledge architecture**:

* **100% Client-Side Execution**: MDCloud has no backend server or database. The entire application runs directly in your browser.
* **Direct-to-Google Communication**: All sync requests, file reading, and file uploading communicate directly and encrypted between your web browser and official Google Drive API endpoints (`https://www.googleapis.com`). No third-party proxy ever touches your files.
* **Zero Secrets in Repository**: MDCloud uses Google Identity Services (GIS) Web Application OAuth 2.0 token flow. It **never** uses or requires a Google Client Secret. Only your public Client ID is stored locally in your browser's private `localStorage`.
* **Local Storage & Offline Privacy**: Your notes and image blobs are cached exclusively inside your browser's private IndexedDB database on your device.

---

## ✨ Features

* 📝 **Dual-Pane Markdown Workspace**: Side-by-side editing and live preview on desktop; clean tabbed switching on mobile and tablet devices.
* 🖼️ **Automated Relative Image Resolution**: Standard Markdown figure paths like `![Figure](./figures/chart.png)` or `![Photo](assets/diagram.png)` resolve directly against your Google Drive subfolder structure.
* 📂 **Folder & Subfolder Drag-and-Drop**: Drop files or entire nested folders directly into the sidebar. MDCloud automatically creates the necessary subfolders in Google Drive and uploads the assets.
* 📐 **LaTeX Math & Diagrams**: Built-in rendering for inline math (`$E=mc^2$`), display blocks (`$$\sum_{i=1}^n x_i$$`) using KaTeX, and Mermaid diagrams (`flowchart`, `sequenceDiagram`, etc.).
* 🔍 **Image Lightbox**: Click any rendered image or diagram in your preview to view in high resolution with full zoom and pan capabilities.
* 📱 **PWA & iOS/iPadOS Optimization**: Installable Progressive Web App with standalone display mode, safe-area insets, and Apple touch icon integration.
* ⚡ **Offline Resilient**: View, edit, and create notes offline with automatic sync status indicators and dirty-state preservation.
* 🔗 **Hash-Based Routing**: Seamless bookmarking and browser history navigation (`#/folder-id/file-id`) that works natively on GitHub Pages without 404 reload errors.

---

## 🚀 One-Time Setup (2 Minutes)

### Step 1: Create a Google Cloud OAuth Client ID

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `My-MDCloud`).
2. Navigate to **APIs & Services** > **Enabled APIs & Services**, click **+ Enable APIs and Services**, search for **Google Drive API**, and click **Enable**.
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   * Choose **External** user type and click **Create**.
   * Enter an App name (e.g., `MDCloud`) and your support email.
   * Add the scope: `.../auth/drive.file` (Per-file access: allows MDCloud to only access files it creates or opens in your designated folder).
   * In the **Test users** section, add your own Google email address.
4. Navigate to **APIs & Services** > **Credentials**, click **Create Credentials** > **OAuth client ID**:
   * Application type: **Web application**.
   * Name: `MDCloud Web Client`.
   * Under **Authorized JavaScript origins**, add:
     * Your production GitHub Pages URL: `https://monzenn.github.io` *(Must be all lowercase, without trailing slash)*
     * For local development: `http://localhost:5173`
   * Click **Create**.
   * Copy the **Client ID** (e.g. `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`). *Note: You do NOT need the Client Secret.*

### Step 2: Prepare Your Google Drive Folder

1. Open [Google Drive](https://drive.google.com/) and create or choose a folder for your notes (e.g. `MDCloud-Notes`).
2. Open the folder and copy its link or Folder ID from the browser address bar (the alphanumeric string after `/folders/`).

### Step 3: Connect in MDCloud

1. Open your MDCloud application in your browser.
2. In the setup / settings modal:
   * Paste your **Google Client ID**.
   * Paste your **Google Drive Folder ID or URL**.
   * Click **Save & Connect**.
3. Sign in with your Google Account when prompted. Your folder tree will load automatically.

---

## 💻 Local Development

To run the project locally:

```bash
# Clone the repository
git clone https://github.com/MonZenn/MDCloud.git
cd MDCloud

# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```

---

## 🌐 Deploying to GitHub Pages

This repository includes an automated GitHub Actions deployment workflow (`.github/workflows/deploy.yml`).

1. Go to your repository settings on GitHub: **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Every push to the `main` branch will automatically build and deploy the app to your GitHub Pages URL (`https://monzenn.github.io/MDCloud/`).

---

## 📄 License

MIT License. Open source and free for personal and commercial use.
