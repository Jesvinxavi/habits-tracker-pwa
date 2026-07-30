let runtime;

function disposeRuntime(value) {
  value?.remoteQueue?.close?.();
  value?.subscriptionUnsubscribers?.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('Cloud subscription cleanup failed:', error);
    }
  });
  value?.syncEngine?.close?.();
}

export function setCloudRuntime(nextRuntime) {
  disposeRuntime(runtime);
  runtime = nextRuntime;
}

export function getCloudRuntime() {
  return runtime;
}

export function clearCloudRuntime() {
  disposeRuntime(runtime);
  runtime = undefined;
}
