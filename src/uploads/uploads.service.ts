import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { copyFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = './uploads/images';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Ensure uploads directory exists
    if (!existsSync(UPLOADS_DIR)) {
      mkdir(UPLOADS_DIR, { recursive: true }).catch((err) =>
        this.logger.error('Failed to create uploads directory', err),
      );
    }

    // Base URL for serving static files
    // Use /api/proxy prefix so frontend can proxy image requests to backend
    // This avoids ngrok browser warning page blocking <img> loads
    this.baseUrl = '/api/proxy';
  }

  async uploadLocal(file: Express.Multer.File): Promise<string> {
    // Get file type from magic bytes
    const { fileTypeFromBuffer } = await import('file-type');
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(file.path);
    const type = await fileTypeFromBuffer(buffer.subarray(0, 4100));

    const ext = type?.ext || 'bin';
    const filename = `${uuidv4()}.${ext}`;
    const destPath = join(UPLOADS_DIR, filename);

    try {
      await copyFile(file.path, destPath);
      this.logger.log(`Saved image locally: ${destPath}`);
      return `${this.baseUrl}/images/${filename}`;
    } finally {
      await this.deleteFile(file.path);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      this.logger.debug(`Deleted temp file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete temp file: ${filePath}`, error);
    }
  }
}
