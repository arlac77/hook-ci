import execa from "execa";

export const defaultProcessorConfig = {};

export async function processJob(job, config, queues, repositories) {
  const url = job.data.repository.url;
  console.log("start: ", url);

  if (!job.data.request.head_commit) {
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

export async function executeStep(step, job, wd) {
  if (step.executable) {
    const cwd = join(wd, step.directory);

    console.log(`${job.id}: ${step.executable} ${step.args.join(" ")}`);
    const proc = execa(
      step.executable,
      step.args,
      Object.assign({ cwd }, step.options)
    );
    proc.stdout.pipe(
      createWriteStream(join(wd, `${step.name}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${step.name}.stderr.log`), utf8Encoding)
    );

    return proc;
  }
}
