# Hashmark

Hashmark is a browser-based tool for generating file and text checksums or verifying a known hash. Files are processed locally in your browser and are not uploaded.

## Features

- Generate **all supported hashes** or select a single algorithm for a quicker result on large files.
- Verify hashes in the Match tab. The app detects candidate algorithms by hash length and checks all candidates where lengths are ambiguous.
- Upload files by browsing or dragging and dropping, or enter text directly.
- View file name and size, follow progress on large files, and copy generated hashes.
- Switch between light and dark themes.

## Supported algorithms

| Algorithm | Implementation |
| --- | --- |
| MD5 | `js-md5` CDN library |
| SHA-1 | Web Crypto API |
| SHA-224 | `js-sha256` CDN library |
| SHA-256 | Web Crypto API |
| SHA-384 | Web Crypto API |
| SHA-512 | Web Crypto API |
| SHA3-256 | `js-sha3` CDN library |
| SHA3-512 | `js-sha3` CDN library |
| CRC32 | `crc-32` CDN library |

> **Security note:** MD5 and SHA-1 are weak and should not be used for security-sensitive purposes.

## Run locally

No build step or package installation is required. Open `index.html` in a browser, or serve the project folder locally:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>. The page loads its hashing libraries from jsDelivr, so an internet connection is required. Web Crypto API algorithms require a secure browser context such as HTTPS or localhost.

## Project structure

```text
.
├── index.html
└── assets
    ├── css
    │   └── styles.css
    └── js
        └── app.js
```
