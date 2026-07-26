import { commitOptimisticOperation, getDeviceId } from '../offlineDb.js';
import { generateUuid } from '../../shared/common.js';

export function createRepository({ entityType, mutationNames, getAccount, syncEngine }) {
  async function persist(kind, { clientId, payload, baseRecord, optimisticRecord, dependsOn }) {
    const account = getAccount();
    if (!account?.ownerKey || !account.generation) throw new Error('No active cloud account');
    const deviceId = account.deviceId || (await getDeviceId());
    const operationId = generateUuid();
    await commitOptimisticOperation({
      operation: {
        operationId,
        ownerKey: account.ownerKey,
        generation: account.generation,
        entityType,
        clientId,
        mutationName: mutationNames[kind],
        payload,
        deviceId,
        dependsOnOperationId: dependsOn,
      },
      confirmedBase: baseRecord,
      optimisticEntity: optimisticRecord,
    });
    syncEngine()?.requestReplay();
    return operationId;
  }
  return {
    create: (command) => persist('create', command),
    update: (command) => persist('update', command),
    remove: (command) => persist('remove', command),
  };
}
