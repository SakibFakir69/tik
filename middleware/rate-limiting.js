


const rateLimit = require("express-rate-limit"); // use require instead of import

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,                   // Limit each IP to 5 requests per windowMs
  standardHeaders: "draft-8", // Send rate limit info in the RateLimit-* headers
  legacyHeaders: false,       // Disable the X-RateLimit-* headers
  message: "Too many requests, please try again later.", // Optional custom message
});

// ✅ No package needed
export function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve).catch(reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

module.exports={limiter};