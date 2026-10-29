const fs = require('node:fs'), path = require('node:path');
module.exports = async function serveStaticBuild(route, directory) {
  const url = new URL(route.request().url());
  const build = path.resolve(directory);
  const relative = decodeURIComponent(url.pathname).replace(/^\/WebShop\/?/, '').replace(/^\//, '');
  const file = path.resolve(build, relative || 'index.html');
  if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return route.fulfill({ status: 404, body: '' });
  }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
};
