import { stripUnusedDataFromHookRequest } from "./util.mjs";
import {
  createGithubHookHandler,
  createGiteaHookHandler,
  createBitbucketHookHandler
} from "koa-github-hook-handler";

const types = {
  "gitea" : createGiteaHookHandler,
  "github" : createGithubHookHandler,
  "bitbucket" : createBitbucketHookHandler
}
export function createHooks(hooks, router, queues) {
  if (hooks === undefined) {
    return;
  }

  for (const t of Object.keys(hooks)) {
    const handler = types[t];
    if(handler === undefined) {
      console.log(`No webhook handler for ${t}`);
      continue;
    }

    const hook = hooks[t];
    const queue = queues[hook.queue];

    router.addRoute(
      "POST",
      hook.path,
      handler(
        {
          delete: async (request, event) => {
            console.log("Received a %s event for %s", event, request);
          },
          'repo:push': async (request, event) => {
            request.event = event;
            if(request.repository && request.repository.links && request.repository.links.html) {
              request.repository.url = request.repository.links.html.href . '.git';
            }

            const job = await queue.add(request);
            return { queued: { id: job.id, queue: job.queue.name } };
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
