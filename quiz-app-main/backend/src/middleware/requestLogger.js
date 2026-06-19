const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[REQUEST] ${log.method} ${log.url} ${log.status} ${log.duration}`);
    } else {
      console.log(JSON.stringify(log));
    }
  });
  
  next();
};

module.exports = requestLogger;
