# MDCloud ☁️

A client-side Markdown note-taking and figure-viewing web app hosted on GitHub Pages that syncs directly with a designated Google Drive folder across Mac, iPad, and iPhone.

## ✨ Features
* **Zero Secrets in Repository**: No private API keys, client secrets, or user credentials committed to git.
* **Automatic Relative Figure Resolution**: Markdown paths like `![Figure](./figures/chart.png)` or `![Figure](chart.png)` resolve directly against your Google Drive folder.
* **iPad & iPhone Home Screen Support**: Optimized PWA with safe-area insets, Apple touch icons, and standalone mode.
* **LaTeX Math & Diagrams**: Built-in support for KaTeX math (`$E=mc^2$`) and Mermaid diagrams.
* **Dual-Pane Workspace**: Live split editor on desktop, tabbed switch on mobile, with drag-and-drop / clipboard image uploading.
* **Offline-Resilient**: Caches notes and image blobs in IndexedDB.

## 🚀 One-Time Setup (2 minutes)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a free project.
2. In **APIs & Services**, enable the **Google Drive API**.
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Application type: *Web application*).
   * Set **Authorized JavaScript origins** to your GitHub Pages URL (e.g. `https://<your-username>.github.io`) and `http://localhost:5173` for development.
4. Open your MDCloud site, enter your **Client ID** and your **Google Drive Folder link**, and click **Save & Connect**.
