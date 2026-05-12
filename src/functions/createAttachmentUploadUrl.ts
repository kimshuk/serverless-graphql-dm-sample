import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});

export async function handler(event: {
  arguments: {
    conversationId: string;
    messageId: string;
    attachmentId: string;
    extension: string;
    contentType: string;
  };
}) {
  const { conversationId, messageId, attachmentId, extension, contentType } =
    event.arguments;

  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    throw new Error("Attachment upload must be an image or video");
  }

  const normalizedExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;
  const key = `${conversationId}/${messageId}/${attachmentId}${normalizedExtension}`;

  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.ATTACHMENT_BUCKET_NAME,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn: 3600 }
  );
}
