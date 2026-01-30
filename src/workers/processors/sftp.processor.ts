import Client from 'ssh2-sftp-client';
import { ProcessorContext, TypeProcessor } from './base.processor.js';
import { SftpConfig } from '../types.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';
import path from 'path';

export class SftpProcessor implements TypeProcessor {
  async processSync(context: ProcessorContext): Promise<{ recordsProcessed: number }> {
    const config = context.config as SftpConfig;
    const sftp = new Client();
    let recordsProcessed = 0;

    logger.info('SFTP sync started', {
      integrationId: context.integrationId,
      host: config.host,
      port: config.port ?? 22,
      remotePath: config.remotePath,
    });

    try {
      // Connect to SFTP server
      await sftp.connect({
        host: config.host,
        port: config.port ?? 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
        readyTimeout: 30000,
        retries: 3,
        retry_minTimeout: 2000,
      });

      logger.info('SFTP connected', { host: config.host });

      // List files in remote directory
      const remotePath = config.remotePath ?? '/';
      const fileList = await sftp.list(remotePath);

      // Filter for files to process (e.g., CSV files not yet processed)
      const filesToProcess = fileList.filter((file) => {
        // Only process regular files (not directories)
        if (file.type !== '-') return false;
        // Only process CSV files
        if (!file.name.toLowerCase().endsWith('.csv')) return false;
        // Skip already processed files (e.g., those starting with 'processed_')
        if (file.name.startsWith('processed_')) return false;
        return true;
      });

      logger.info('Found files to process', {
        integrationId: context.integrationId,
        count: filesToProcess.length,
        files: filesToProcess.map((f) => f.name),
      });

      // Process each file
      for (const file of filesToProcess) {
        const remoteFilePath = path.posix.join(remotePath, file.name);

        try {
          // Download file content
          const content = await sftp.get(remoteFilePath);
          const fileContent = content.toString();

          // Parse CSV content (simple parsing - in production use csv-parser)
          const lines = fileContent.split('\n').filter((line) => line.trim());
          const headers = lines[0]?.split(',').map((h) => h.trim().toLowerCase());
          const dataLines = lines.slice(1);

          if (!headers || headers.length === 0) {
            logger.warn('Skipping file with no headers', { file: file.name });
            continue;
          }

          logger.info('Processing file', {
            file: file.name,
            headers,
            rowCount: dataLines.length,
          });

          // Process each data row
          for (const line of dataLines) {
            const values = line.split(',').map((v) => v.trim());
            if (values.length < headers.length) continue;

            // Create a record object from the CSV row
            const record: Record<string, string> = {};
            headers.forEach((header, index) => {
              record[header] = values[index] ?? '';
            });

            // Log record processing (actual business logic would go here)
            logger.debug('Processing record', { record });
            recordsProcessed++;
          }

          // Mark file as processed by renaming
          if (config.archiveProcessed !== false) {
            const archivePath = config.archivePath ?? remotePath;
            const processedName = `processed_${new Date().toISOString().replace(/[:.]/g, '-')}_${file.name}`;
            const newPath = path.posix.join(archivePath, processedName);

            try {
              await sftp.rename(remoteFilePath, newPath);
              logger.info('Archived processed file', { from: remoteFilePath, to: newPath });
            } catch (renameError) {
              logger.warn('Could not archive file', {
                file: file.name,
                error: String(renameError),
              });
            }
          }

          // Record file upload in database
          await prisma.fileUpload.create({
            data: {
              integrationId: context.integrationId,
              fileName: file.name,
              fileSize: file.size,
              fileType: 'text/csv',
              status: 'COMPLETED',
              recordCount: dataLines.length,
              processedAt: new Date(),
              createdBy: context.triggeredBy,
            },
          });
        } catch (fileError) {
          logger.error('Error processing file', {
            file: file.name,
            error: String(fileError),
          });

          // Record failed file upload
          await prisma.fileUpload.create({
            data: {
              integrationId: context.integrationId,
              fileName: file.name,
              fileSize: file.size,
              fileType: 'text/csv',
              status: 'FAILED',
              errorDetails: String(fileError),
              createdBy: context.triggeredBy,
            },
          });
        }
      }

      // Generate and upload acknowledgment file if configured
      if (config.ackPath && filesToProcess.length > 0) {
        const ackContent = JSON.stringify({
          timestamp: new Date().toISOString(),
          filesProcessed: filesToProcess.map((f) => f.name),
          recordsProcessed,
          status: 'SUCCESS',
        });

        const ackFileName = `ack_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const ackFilePath = path.posix.join(config.ackPath, ackFileName);

        await sftp.put(Buffer.from(ackContent), ackFilePath);
        logger.info('Uploaded acknowledgment file', { path: ackFilePath });
      }
    } finally {
      // Always close the connection
      await sftp.end();
      logger.info('SFTP connection closed');
    }

    logger.info('SFTP sync completed', {
      integrationId: context.integrationId,
      recordsProcessed,
    });

    return { recordsProcessed };
  }
}

export const sftpProcessor = new SftpProcessor();
