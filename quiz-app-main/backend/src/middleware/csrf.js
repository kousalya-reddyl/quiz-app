const csrfProtection = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  if (!token) {
    return next();
  }

  return next();
};

module.exports = {
  csrfProtection
};
