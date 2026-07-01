// Loads .env.local before any module that reads process.env at import time
// (e.g. lib/cloudinary configures itself on import). Must be the FIRST import
// in the worker entrypoint.
import { config } from "dotenv";

config({ path: ".env.local" });
