export const utf8Encoding = { encoding: "utf8" };


export function createStep(step) {
  step.execute = async (job, wd) => {
    const proc = execa(step.executable, step.args, { cwd: step.directory });
    proc.stdout.pipe(
      createWriteStream(join(wd, `${step.name}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${step.name}.stderr.log`), utf8Encoding)
    );

    job.progress(step.progress);

    return proc;
  };

  return step;
}
