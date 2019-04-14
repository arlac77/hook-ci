//import createHandler from "github-webhook-handler";

export function createHookHandler(config,requestQueue) {
  const handler = createHandler(config.http.hook);

  handler.on("error", err => {
    console.error("Error:", err.message);
  });

  handler.on("ping", async event => {
    console.log(
      "Received a ping event for %s",
      event.payload.repository.full_name
    );

    const counts = await requestQueue.getJobCounts();
    console.log("COUNTS", counts);
  });

  handler.on("push", async event => {
    try {
      console.log(
        "Received a push event for %s to %s",
        event.payload.repository.full_name,
        event.payload.ref
      );

      requestQueue.add(event.payload);
    } catch (e) {
      console.error(e);
    }
  });

  return handler;
}
