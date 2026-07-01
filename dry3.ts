import { config } from "dotenv"; config({ path: ".env.local" });
process.env.SUBMIT_DRY_RUN = "1";
(async () => {
  const { runCloudSubmission } = await import("./lib/submit/cloud");
  for (const id of ["d83cff4b-63dc-4df1-8b0d-cf28eea8f53c","d50dffe1-b42f-4fdb-a116-fe7f78752f76"]) {
    console.log("\n##### APP", id);
    const r = await runCloudSubmission(id);
    console.log("RESULT", JSON.stringify(r));
  }
  process.exit(0);
})();
