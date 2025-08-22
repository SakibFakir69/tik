import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,                   // Limit each IP to 5 requests per windowMs
  standardHeaders: "draft-8", // Send rate limit info in the RateLimit-* headers
  legacyHeaders: false,       // Disable the X-RateLimit-* headers
  message: "Too many requests, please try again later.", // Optional custom message
});


module.exports={limiter};