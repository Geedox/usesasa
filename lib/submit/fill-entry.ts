// Injection entry point. esbuild bundles this (and its imports) into one IIFE.
// The bundle, once evaluated in a page, leaves `window.__sasaFill` callable.
import { fillAndSubmit } from "../../extension/lib/fill-form";

declare global {
  interface Window {
    __sasaFill: typeof fillAndSubmit;
  }
}

window.__sasaFill = fillAndSubmit;
