import execa from "execa";


export const defaultProcessorConfig = {
  git: {
    clone: {
      depth: 10
    }
  },
  workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp/hook-ci')}" }
};

export async function processJob(job,config) {
  const url = job.data.repository.url;
  console.log("start: ", url);

  if (!job.data.head_commit) {
    console.log("no commit id present");
    return {
      url
    };
  }

  const commit = job.data.request.head_commit.id;
  const wd = join(config.workspace.dir, commit);

  try {
    await fs.promises.access(wd, fs.constants.W_OK);
    console.log(`${wd} already present`);
  } catch (err) {
    const proc = execa("git", [
      "clone",
      "--depth",
      config.git.clone.depth,
      url,
      wd
    ]);
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
    await proc;
  }

  job.progress(10);

  const steps = (await Promise.all([
    npmAnalyse(config, wd),
    pkgbuildAnalyse(config, wd)
  ])).reduce((a, c) => {
    a.push(...c);
    return a;
  }, []);

  for (const step of steps) {
    try {
      console.log(`${job.id}: start ${step.name} (${wd})`);
      const process = await step.execute(job, wd);
      console.log(`${job.id}: end ${step.name} ${process.code}`);
    } catch (e) {
      console.log(`${job.id}: failed ${step.name}`, e);
    }
  }

  return {
    url,
    wd,
    arch: process.arch
  };
}
