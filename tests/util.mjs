export function makeJob(id, data={}) {
  return {
    id,
    progress() {},
    log(line) { console.log(line)},
    data
  };
}
