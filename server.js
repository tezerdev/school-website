const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname);
const IMAGE_DIR = path.join(ROOT_DIR, 'gallery-images');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=UTF-8',
};

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) {
    return null;
  }
  return targetPath;
}

async function listGalleryImages() {
  const folders = {};
  try {
    const entries = await fs.readdir(IMAGE_DIR, { withFileTypes: true });
    for (const dirent of entries) {
      if (!dirent.isDirectory()) continue;
      const folderName = dirent.name;
      const folderPath = path.join(IMAGE_DIR, folderName);
      const files = await fs.readdir(folderPath, { withFileTypes: true });
      const images = files
        .filter(file => file.isFile() && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(file => ({
          name: file.name,
          url: `/gallery-images/${encodeURIComponent(folderName)}/${encodeURIComponent(file.name)}`
        }));
      folders[folderName] = images;
    }
  } catch (err) {
    console.error('Failed to read gallery images:', err);
  }
  return folders;
}

async function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = safeJoin(ROOT_DIR, filePath);
  if (!fullPath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Bad request');
    return;
  }

  try {
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      const indexPath = path.join(fullPath, 'index.html');
      const indexStats = await fs.stat(indexPath);
      if (indexStats.isFile()) {
        return sendFile(res, indexPath);
      }
    }
    if (stats.isFile()) {
      return sendFile(res, fullPath);
    }
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Not found');
  }
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath)
    .then(content => {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    })
    .catch(() => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Server error');
    });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/images') {
    const data = await listGalleryImages();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify(data));
    return;
  }

  await serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
