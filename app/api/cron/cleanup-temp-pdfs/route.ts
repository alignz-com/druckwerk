import { NextResponse } from "next/server"
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { s3, UPLOADS_BUCKET } from "@/lib/s3"

export const runtime = "nodejs"

const MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function GET() {
  const cutoff = new Date(Date.now() - MAX_AGE_MS)
  const toDelete: { Key: string }[] = []

  let continuationToken: string | undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: UPLOADS_BUCKET,
      Prefix: "temp/",
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.LastModified && obj.LastModified < cutoff) {
        toDelete.push({ Key: obj.Key })
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  if (toDelete.length > 0) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: UPLOADS_BUCKET,
      Delete: { Objects: toDelete },
    }))
  }

  return NextResponse.json({ deleted: toDelete.length })
}
