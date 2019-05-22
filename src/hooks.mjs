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
          push: async (request, event) => {
            request = stripUnusedDataFromHookRequest(request);
            request.event = event;
            await queue.add(request);
            return { ok: true };
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
