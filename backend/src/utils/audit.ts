import { prisma } from '../lib/prisma';

/**
 * Records a simple log in the audit_logs table.
 */
export const logAction = async (
  userId: string,
  action: string,
  tableName: string,
  recordId: string
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        table_name: tableName,
        record_id: recordId,
      },
    });
  } catch (error) {
    console.error('[AUDIT ERROR]: Erro ao gravar log de auditoria:', error);
  }
};
