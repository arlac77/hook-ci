import { Service } from "@kronos-integration/service";
import { stripUnusedDataFromHookRequest } from "./util.mjs";

export class ServiceHooks extends Service {
  static get name() {
    return "hooks";
  }

  static get endpoints() {
    return {
      ...super.endpoints,
      push: {
        receive: "push"
      }
    };
  }

  async push(request) {}
}

/*

  for (const t of Object.keys(hooks)) {
    const handler = types[t];
    if (handler === undefined) {
      console.log(`No webhook handler for ${t}`);
      continue;
    }

    const hook = hooks[t];
    const queue = queues[hook.queue];

    const logOnly = (request, event) =>
      console.log("Received a %s event for %s", event, request);

    router.addRoute(
      "POST",
      hook.path,
      handler(
        {
          repository: logOnly,
          create: logOnly,
          delete: logOnly,
          check_suite: logOnly,
          check_run: logOnly,
          "repo:push": async (request, event) => {
            request.event = event;
            if (
              request.repository &&
              request.repository.links &&
              request.repository.links.html
            ) {
              request.repository.url =
                request.repository.links.html.href + ".git";
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
*/
