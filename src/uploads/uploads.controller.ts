import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFile, unlink } from 'fs/promises';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadResponseDto } from './dto/upload-response.dto';
import { UploadsService } from './uploads.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
  ): Promise<UploadResponseDto> {
    // Ensure user is authenticated (userId comes from JWT)
    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    // Validate file exists
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    try {
      // Read file buffer for magic byte validation
      const buffer = await readFile(file.path);

      // Use dynamic import for ESM-only file-type package
      const { fileTypeFromBuffer } = await import('file-type');

      // Check magic bytes from first 4100 bytes
      const fileType = await fileTypeFromBuffer(buffer.subarray(0, 4100));

      // Validate file type by magic bytes (not MIME header)
      if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
        // Delete temp file if validation fails
        await this.deleteFile(file.path);
        throw new BadRequestException(
          'File must be a valid image (JPEG, PNG, or WebP)',
        );
      }

      // Upload to R2 and get public URL
      // Service handles temp file cleanup after upload
      const url = await this.uploadsService.uploadToR2(file);
      return { url };
    } catch (error) {
      // Clean up temp file on validation errors
      // Note: uploadToR2 handles its own cleanup in finally block
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For unexpected errors, try to clean up
      await this.deleteFile(file.path);
      throw new BadRequestException('Failed to process image file');
    }
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // Ignore deletion errors (file may already be deleted by service)
    }
  }
}
