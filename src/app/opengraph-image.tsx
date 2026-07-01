import {
  createShareImageResponse,
  shareImageAlt,
  shareImageContentType,
  shareImageSize,
} from "@/lib/share-image";

export const alt = shareImageAlt;
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function Image() {
  return createShareImageResponse();
}
