export function makeJob(id, data={}) {
  return {
    id,
    progress() {},
    log(line) { console.log(line)},
    data
  };
}


export function makeConfig(port)
{
  return {
    version: 99,
    http: {
      port
    },
    auth: {
      jwt: {
      }
    }
  };
}

