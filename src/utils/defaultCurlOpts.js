const opts = {
  acceptEncoding: "gzip",
  httpHeader: ["User-Agent: VaccineSpotter.org"],
  timeoutMs: 15000,
};

if (process.env.SSL_CERT_FILE) {
  opts.caInfo = process.env.SSL_CERT_FILE;
}

if (process.env.SSL_CERT_DIR) {
  opts.caPath = process.env.SSL_CERT_DIR;
}

module.exports = opts;
