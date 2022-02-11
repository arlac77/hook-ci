import yaml from "js-yaml";

export async function travisAnalyse(branch, job, config, wd) {
  const steps = [];

  for await (const entry of branch.entries(".travis.yml")) {
    const yml = yaml.safeLoad(await entry.string);
    console.log(yml);
  }
  return steps;
}
