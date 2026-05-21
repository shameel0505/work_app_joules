import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private endpointUrl: string;

  constructor() {
    this.endpointUrl = process.env.S3_ENDPOINT || 'http://localhost:9000';
    this.bucketName = process.env.S3_BUCKET || 'aidea-uploads';

    this.s3Client = new S3Client({
      endpoint: this.endpointUrl,
      forcePathStyle: true,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
    });
  }

  async createBucketIfNotExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
      } else {
        console.error('Error checking/creating S3 bucket:', error);
      }
    }
  }

  async uploadFile(buffer: Buffer, mimetype: string, folder: string): Promise<string> {
    const extension = mimetype.split('/')[1] || 'bin';
    const key = `${folder}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    });

    await this.s3Client.send(command);

    return `${this.endpointUrl}/${this.bucketName}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    // If a full URL is passed, extract the key
    const prefix = `${this.endpointUrl}/${this.bucketName}/`;
    let objectKey = key;
    if (key.startsWith(prefix)) {
        objectKey = key.replace(prefix, '');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    await this.s3Client.send(command);
  }
}
