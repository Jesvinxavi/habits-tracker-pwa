let runtime;

export function setCloudRuntime(nextRuntime) {
  runtime?.syncEngine?.close();
  runtime = nextRuntime;
}

export function getCloudRuntime() {
  return runtime;
}

export function clearCloudRuntime() {
  runtime?.syncEngine?.close();
  runtime = undefined;
}
