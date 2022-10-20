import test from "ava";
import { createContext } from "expression-expander";
import { executeStep } from "../src/processor.mjs";
import { makeJob, makeQueue } from './helpers/util.mjs';

test("executeStep", async t => {

  function evaluate(expression) {
    expression = expression.trim();
    if (expression === 'workspaceDirectory') {
      return wd;
    }

    return expression;
  }

  const eeContext = createContext({
    leftMarker: '{{',
    rightMarker: '}}',
    markerRegexp: '{{([^}]+)}}',
    evaluate
  });

  const proc = await executeStep(
    {
      timeout: 10000,
      name: "echo",
      directory: ".",
      executable: "npm",
      args: ["--version"]
    },
    makeQueue('processor'),
    makeJob(1),
    eeContext  );

  t.is(proc.exitCode, 0);
  t.regex(proc.stdout, /\d+\.\d+\.\d+/);
});
