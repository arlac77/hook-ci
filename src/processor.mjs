import execa from "execa";

export const defaultProcessorConfig = {};

export async function processJob(job, config, queues, repositories) {
  const data = job.data;
  const wd = data.wd;

  for (const step of data.steps) {
    try {
      console.log(`${job.id}: start ${step.name} (${wd})`);
      const process = await step.execute(job, wd);
      console.log(`${job.id}: end ${step.name} ${process.code}`);
    } catch (e) {
      console.log(`${job.id}: failed ${step.name}`, e);
    }
  }
}

export async function executeStep(step, job, wd) {
  if (step.executable) {
    const cwd = join(wd, step.directory);

    console.log(`${job.id}: ${step.executable} ${step.args.join(" ")}`);
    const proc = execa(step.executable, step.args, { cwd, ...step.options });
    proc.stdout.pipe(
      createWriteStream(join(wd, `${step.name}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${step.name}.stderr.log`), utf8Encoding)
    );

    return proc;
  }
}
