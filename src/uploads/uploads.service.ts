import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile, unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';

    // Initialize S3Client only if credentials are provided
    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('R2 client initialized');
    } else {
      this.logger.warn('R2 credentials not configured - uploads will use mock URL');
    }
  }

  async uploadToR2(file: Express.Multer.File): Promise<string> {
    if (!this.s3Client) {
      this.logger.warn('R2 not configured, returning mock URL');
      await this.deleteFile(file.path);
      return 'https://mock-r2-url.example.com/images/mock-image.jpg';
    }

    const buffer = await readFile(file.path);

    // Get file type from magic bytes
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer.subarray(0, 4100));

    const ext = type?.ext || 'bin';
    const key = `images/${uuidv4()}.${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: type?.mime || 'application/octet-stream',
        }),
      );

      this.logger.log(`Uploaded image to R2: ${key}`);
      return `${this.publicUrl}/${key}`;
    } finally {
      // Always clean up temp file
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
