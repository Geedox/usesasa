import { defineContentScript } from "wxt/utils/define-content-script";
import { fillAndSubmit } from "@/lib/fill-form";
import type { FillMessage } from "./background";

// Ashby is a React SPA; the application form renders at jobs.ashbyhq.com/<org>/<id>/application.
export default defineContentScript({
  matches: ["*://*.ashbyhq.com/*"],
  main() {
    chrome.runtime.onMessage.addListener((msg: FillMessage, _sender, sendResponse) => {
      if (msg?.type === "fill") {
        fillAndSubmit(
          {
            fields: msg.app.fields,
            coverLetter: msg.app.coverLetter,
            answers: msg.app.answers,
            resumeBase64: msg.resumeBase64,
            resumeName: msg.resumeName,
          },
          {
            submitSelectors: ['button[type="submit"]', "button.ashby-application-form-submit-button"],
            submitTextRe: /submit/i,
            requestAnswers: (questions) =>
              chrome.runtime
                .sendMessage({ type: "answer", applicationId: msg.app.id, questions })
                .then((r) => (r as { answers?: Record<string, string> })?.answers ?? {}),
          },
        )
          .then(sendResponse)
          .catch(() => sendResponse({ result: "failed" }));
        return true; // async
      }
      return undefined;
    });
  },
});
