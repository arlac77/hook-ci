import { stripUnusedDataFromHookRequest } from "./util.mjs";
import {
  createGithubHookHandler,
  createGiteaHookHandler
} from "koa-github-hook-handler";

export function createHooks(hooks, router, queues) {
  if (hooks === undefined) {
    return;
  }

  for (const t of Object.keys(hooks)) {
    const hook = hooks[t];
    const queue = queues[hook.queue];

    const handler =
      t === "gitea" ? createGiteaHookHandler : createGithubHookHandler;
    router.addRoute(
      "POST",
      hook.path,
      handler(
        {
          delete: async (request, event) => {
            console.log("Received a %s event for %s", event, request);
          },
          push: async (request, event) => {
            request = stripUnusedDataFromHookRequest(request);
            request.event = event;
            const job = await queue.add(request);
            return { queued: { id: job.id, queue: job.queue.name } };
          },
          pull_request: async (request, event) => {
            console.log(
              "Received a %s event for %s#%s",
              event,
              request.repository.full_name,
              request.ref
            );
            return { ok: true };
          },
          ping: async (request, event) => {
            console.log(
              "Received a %s event for %s#%s",
              event,
              request.repository.full_name,
              request.ref
            );
            return { ok: true };
          }
        },
        hook
      )
    );
  }
}
